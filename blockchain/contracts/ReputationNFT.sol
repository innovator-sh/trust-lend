// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title  ReputationNFT
 * @author TrustLend Team
 * @notice Soulbound (non-transferable) ERC-721 NFT representing each user's
 *         on-chain credit identity within the TrustLend ecosystem.
 *
 * @dev    Architecture overview
 *
 *   ┌──────────────┐  mintReputationNFT()   ┌─────────────────┐
 *   │ LendingPool  │ ──────────────────────▶ │  ReputationNFT  │
 *   │  (trusted)   │  updateReputation()     │  (Soulbound)    │
 *   └──────────────┘ ──────────────────────▶ └─────────────────┘
 *                                                    │
 *                          getReputation() / tokenURI() (public reads)
 *                                                    │
 *                                                    ▼
 *                                              Anyone can view
 *
 * Key properties:
 *  • One NFT per wallet — enforced on mint.
 *  • Fully non-transferable — all ERC-721 transfer/approval entry-points revert.
 *  • Only the designated LendingPool address can update scores.
 *  • 100 % on-chain metadata — JSON + SVG art encoded as base64 data URIs.
 *  • Tier ladder: Entry (30-39) → Bronze (40-59) → Silver (60-79) → Gold (80-100).
 */
contract ReputationNFT is ERC721, Ownable {
    using Strings for uint256;
    using Strings for uint8;

    /* ══════════════════════════════════════════
       STRUCTS
    ═══════════════════════════════════════════ */

    /**
     * @notice All on-chain reputation metadata stored per wallet.
     * @param trustScore        Current credit score in range [0, 100].
     * @param tier              Human-readable tier label (Entry/Bronze/Silver/Gold).
     * @param loansRepaid       Total count of successfully repaid loans.
     * @param totalBorrowed     Cumulative principal borrowed (in TRUST token wei).
     * @param totalRepaid       Cumulative amount repaid including interest (in TRUST token wei).
     * @param memberSince       Unix timestamp of the first minted NFT.
     * @param repaymentStreak   Consecutive on-time repayment count; resets on late payment.
     * @param earningArchetype  Behavioural label: "Daily" / "Weekly" / "Seasonal".
     */
    struct ReputationData {
        uint8   trustScore;
        string  tier;
        uint256 loansRepaid;
        uint256 totalBorrowed;
        uint256 totalRepaid;
        uint256 memberSince;
        uint8   repaymentStreak;
        string  earningArchetype;
    }

    /* ══════════════════════════════════════════
       STATE
    ═══════════════════════════════════════════ */

    /// @notice Address of the LendingPool contract authorised to update reputation data.
    address public lendingPoolAddress;

    /// @dev Auto-incrementing token ID counter (starts at 1).
    uint256 private _nextTokenId;

    /// @dev wallet → minted tokenId (0 means no NFT yet).
    mapping(address => uint256) private _walletToTokenId;

    /// @dev tokenId → full on-chain reputation data.
    mapping(uint256 => ReputationData) private _reputationData;

    /* ══════════════════════════════════════════
       CONSTANTS
    ═══════════════════════════════════════════ */

    /// @dev Initial trust score assigned at mint.
    uint8 private constant INITIAL_SCORE = 30;

    /// @dev Tier score boundaries (inclusive lower bounds).
    uint8 private constant SCORE_GOLD   = 80;
    uint8 private constant SCORE_SILVER = 60;
    uint8 private constant SCORE_BRONZE = 40;

    /* ══════════════════════════════════════════
       EVENTS
    ═══════════════════════════════════════════ */

    /**
     * @notice Emitted when a new Reputation NFT is minted for a wallet.
     * @param wallet    The recipient's address.
     * @param tokenId   The newly minted token ID.
     * @param timestamp Block timestamp at time of mint (memberSince).
     */
    event ReputationNFTMinted(
        address indexed wallet,
        uint256 indexed tokenId,
        uint256         timestamp
    );

    /**
     * @notice Emitted each time the LendingPool updates a wallet's reputation.
     * @param wallet     The wallet whose reputation changed.
     * @param oldScore   Trust score before the update.
     * @param newScore   Trust score after the update.
     * @param newTier    Tier label corresponding to `newScore`.
     * @param newStreak  Repayment streak after this update.
     */
    event ReputationUpdated(
        address indexed wallet,
        uint8           oldScore,
        uint8           newScore,
        string          newTier,
        uint8           newStreak
    );

    /**
     * @notice Emitted when the owner changes the authorised LendingPool address.
     * @param oldPool Previous LendingPool address.
     * @param newPool New LendingPool address.
     */
    event LendingPoolUpdated(address indexed oldPool, address indexed newPool);

    /* ══════════════════════════════════════════
       MODIFIERS
    ═══════════════════════════════════════════ */

    /**
     * @dev Restricts a function to only be callable by the registered LendingPool.
     */
    modifier onlyLendingPool() {
        require(
            msg.sender == lendingPoolAddress,
            "ReputationNFT: caller is not LendingPool"
        );
        _;
    }

    /* ══════════════════════════════════════════
       CONSTRUCTOR
    ═══════════════════════════════════════════ */

    /**
     * @notice Deploy the ReputationNFT contract.
     * @dev    Token IDs begin at 1. The LendingPool address can be set later via
     *         `setLendingPool` once the LendingPool is deployed.
     * @param _lendingPool Initial LendingPool address (may be address(0) at deploy
     *                     time and set later).
     */
    constructor(address _lendingPool) ERC721("TrustLend Reputation", "TREP") Ownable(msg.sender) {
        lendingPoolAddress = _lendingPool;
        _nextTokenId = 1;
    }

    /* ══════════════════════════════════════════
       ADMIN FUNCTIONS
    ═══════════════════════════════════════════ */

    /**
     * @notice Update the authorised LendingPool address.
     * @dev    Only the contract owner can call this. Required when re-deploying
     *         the LendingPool or setting it for the first time post-deploy.
     * @param newPool The new LendingPool contract address.
     *
     * Emits {LendingPoolUpdated}.
     */
    function setLendingPool(address newPool) external onlyOwner {
        require(newPool != address(0), "ReputationNFT: zero address");
        address old = lendingPoolAddress;
        lendingPoolAddress = newPool;
        emit LendingPoolUpdated(old, newPool);
    }

    /* ══════════════════════════════════════════
       CORE FUNCTIONS
    ═══════════════════════════════════════════ */

    /**
     * @notice Mint a Reputation NFT for a new TrustLend user.
     * @dev    Called by the LendingPool on a borrower's first-ever loan request.
     *         Each wallet is limited to exactly one NFT (ensured by the
     *         `_walletToTokenId` mapping check).
     *         Initial score is set to 30 (Entry tier) and `memberSince` is
     *         recorded as the current block timestamp.
     * @param  to The wallet address to mint the NFT to.
     *
     * Emits {ReputationNFTMinted}.
     */
    function mintReputationNFT(address to) external onlyLendingPool {
        require(to != address(0),              "ReputationNFT: mint to zero address");
        require(_walletToTokenId[to] == 0,     "ReputationNFT: wallet already has NFT");

        uint256 tokenId = _nextTokenId++;

        _safeMint(to, tokenId);

        _walletToTokenId[to] = tokenId;
        _reputationData[tokenId] = ReputationData({
            trustScore:       INITIAL_SCORE,
            tier:             "Entry",
            loansRepaid:      0,
            totalBorrowed:    0,
            totalRepaid:      0,
            memberSince:      block.timestamp,
            repaymentStreak:  0,
            earningArchetype: "Daily"
        });

        emit ReputationNFTMinted(to, tokenId, block.timestamp);
    }

    /**
     * @notice Update all reputation metadata for a wallet after a loan event.
     * @dev    Only the registered LendingPool may call this function.
     *         Tier is recalculated from `newScore`:
     *           • 30–39 → "Entry"
     *           • 40–59 → "Bronze"
     *           • 60–79 → "Silver"
     *           • 80–100 → "Gold"
     *         Repayment streak is incremented for on-time payments and reset to
     *         zero for late payments. `earningArchetype` is derived from the
     *         updated streak: ≥30 → "Seasonal", ≥7 → "Weekly", else → "Daily".
     *         `loansRepaid`, `totalBorrowed`, and `totalRepaid` are incremented.
     * @param  wallet        The borrower's wallet address.
     * @param  newScore      New trust score (0–100).
     * @param  loanAmount    Principal of the loan just processed (TRUST wei).
     * @param  repaidOnTime  `true` if repayment was made before or on the due date.
     *
     * Emits {ReputationUpdated}.
     */
    function updateReputation(
        address wallet,
        uint8   newScore,
        uint256 loanAmount,
        bool    repaidOnTime
    ) external onlyLendingPool {
        require(wallet != address(0),         "ReputationNFT: zero address");
        require(newScore <= 100,              "ReputationNFT: score exceeds 100");

        uint256 tokenId = _walletToTokenId[wallet];
        require(tokenId != 0,                "ReputationNFT: wallet has no NFT");

        ReputationData storage data = _reputationData[tokenId];

        uint8  oldScore = data.trustScore;
        string memory newTier = _tierFromScore(newScore);

        // Update streak
        uint8 newStreak;
        if (repaidOnTime) {
            // Cap streak at 255 (uint8 max) to avoid overflow
            newStreak = data.repaymentStreak < type(uint8).max
                ? data.repaymentStreak + 1
                : type(uint8).max;
        } else {
            newStreak = 0;
        }

        // Derive earning archetype from streak
        string memory archetype;
        if (newStreak >= 30) {
            archetype = "Seasonal";
        } else if (newStreak >= 7) {
            archetype = "Weekly";
        } else {
            archetype = "Daily";
        }

        // Write all updates
        data.trustScore       = newScore;
        data.tier             = newTier;
        data.loansRepaid      += 1;
        data.totalBorrowed    += loanAmount;
        data.totalRepaid      += loanAmount; // caller may pass exact repaid amount; using loanAmount as principal proxy
        data.repaymentStreak  = newStreak;
        data.earningArchetype = archetype;

        emit ReputationUpdated(wallet, oldScore, newScore, newTier, newStreak);
    }

    /* ══════════════════════════════════════════
       VIEW FUNCTIONS
    ═══════════════════════════════════════════ */

    /**
     * @notice Retrieve the full on-chain reputation data for a wallet.
     * @param  wallet Address to query.
     * @return        A {ReputationData} struct with all fields populated.
     */
    function getReputation(address wallet) external view returns (ReputationData memory) {
        uint256 tokenId = _walletToTokenId[wallet];
        require(tokenId != 0, "ReputationNFT: wallet has no NFT");
        return _reputationData[tokenId];
    }

    /**
     * @notice Retrieve just the tier label for a wallet.
     * @param  wallet Address to query.
     * @return        One of "Entry", "Bronze", "Silver", or "Gold".
     */
    function getTier(address wallet) external view returns (string memory) {
        uint256 tokenId = _walletToTokenId[wallet];
        require(tokenId != 0, "ReputationNFT: wallet has no NFT");
        return _reputationData[tokenId].tier;
    }

    /**
     * @notice Check whether a wallet holds a Reputation NFT.
     * @param  wallet Address to query.
     * @return        `true` if the wallet has been minted an NFT, `false` otherwise.
     */
    function hasNFT(address wallet) external view returns (bool) {
        return _walletToTokenId[wallet] != 0;
    }

    /**
     * @notice Returns the token ID owned by a wallet, or 0 if none.
     * @param  wallet Address to query.
     * @return        The token ID, or 0.
     */
    function tokenIdOf(address wallet) external view returns (uint256) {
        return _walletToTokenId[wallet];
    }

    /* ══════════════════════════════════════════
       TOKEN URI (FULLY ON-CHAIN)
    ═══════════════════════════════════════════ */

    /**
     * @notice Returns a base64-encoded data URI containing JSON metadata and
     *         an on-chain SVG image. No external IPFS or server dependency.
     * @dev    SVG shows the trust score (large numeral) and tier name against a
     *         rich dark background with gold typography — simple yet impactful.
     * @param  tokenId The NFT token ID to query.
     * @return         A `data:application/json;base64,...` URI string.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        ReputationData memory data = _reputationData[tokenId];

        string memory svgImage = _buildSVG(data);
        string memory imageDataURI = string(
            abi.encodePacked(
                "data:image/svg+xml;base64,",
                Base64.encode(bytes(svgImage))
            )
        );

        string memory json = string(
            abi.encodePacked(
                '{"name":"TrustLend Reputation #', tokenId.toString(), '",',
                '"description":"Soulbound on-chain credit identity for the TrustLend protocol.",',
                '"image":"', imageDataURI, '",',
                '"attributes":[',
                    '{"trait_type":"Trust Score","value":', uint256(data.trustScore).toString(), '},',
                    '{"trait_type":"Tier","value":"', data.tier, '"},',
                    '{"trait_type":"Loans Repaid","value":', data.loansRepaid.toString(), '},',
                    '{"trait_type":"Total Borrowed","value":', data.totalBorrowed.toString(), '},',
                    '{"trait_type":"Total Repaid","value":', data.totalRepaid.toString(), '},',
                    '{"trait_type":"Member Since","value":', data.memberSince.toString(), '},',
                    '{"trait_type":"Repayment Streak","value":', uint256(data.repaymentStreak).toString(), '},',
                    '{"trait_type":"Earning Archetype","value":"', data.earningArchetype, '"}',
                ']}'
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    /* ══════════════════════════════════════════
       SOULBOUND — TRANSFER OVERRIDES
    ═══════════════════════════════════════════ */

    /**
     * @dev Override to enforce soulbound constraint.
     *      All token transfers (including minting path via {_safeMint}) pass
     *      through {_update}. We allow minting (from == address(0)) but block
     *      any movement once an NFT is minted.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("ReputationNFT: Soulbound \u2014 non-transferable");
        }
        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Blocked. ReputationNFTs are non-transferable.
     * @dev    Always reverts with a soulbound error message.
     */
    function transferFrom(
        address, /* from */
        address, /* to */
        uint256  /* tokenId */
    ) public pure override {
        revert("ReputationNFT: Soulbound \u2014 non-transferable");
    }

    /**
     * @notice Blocked. ReputationNFTs are non-transferable.
     * @dev    Always reverts with a soulbound error message.
     */
    function safeTransferFrom(
        address, /* from */
        address, /* to */
        uint256, /* tokenId */
        bytes memory /* data */
    ) public pure override {
        revert("ReputationNFT: Soulbound \u2014 non-transferable");
    }

    /**
     * @notice Blocked. Token-level approvals serve no purpose on a soulbound token.
     * @dev    Always reverts with a soulbound error message.
     */
    function approve(
        address, /* to */
        uint256  /* tokenId */
    ) public pure override {
        revert("ReputationNFT: Soulbound \u2014 non-transferable");
    }

    /**
     * @notice Blocked. Operator approvals serve no purpose on a soulbound token.
     * @dev    Always reverts with a soulbound error message.
     */
    function setApprovalForAll(
        address, /* operator */
        bool     /* approved */
    ) public pure override {
        revert("ReputationNFT: Soulbound \u2014 non-transferable");
    }

    /* ══════════════════════════════════════════
       INTERNAL HELPERS
    ═══════════════════════════════════════════ */

    /**
     * @dev Derives the tier label string from a numeric trust score.
     * @param score Trust score in [0, 100].
     * @return      Tier string: "Gold", "Silver", "Bronze", or "Entry".
     */
    function _tierFromScore(uint8 score) internal pure returns (string memory) {
        if (score >= SCORE_GOLD)   return "Gold";
        if (score >= SCORE_SILVER) return "Silver";
        if (score >= SCORE_BRONZE) return "Bronze";
        return "Entry";
    }

    /**
     * @dev Builds the on-chain SVG art for a given ReputationData snapshot.
     *      Visual design:
     *        • Dark charcoal background (#0f0f1a)
     *        • Subtle gold radial glow behind the score circle
     *        • Large gold score numeral centred in a glowing ring
     *        • Tier label below in a gold accent font
     *        • Protocol name and streak badge at the bottom
     * @param data Full ReputationData struct for the NFT.
     * @return     Raw SVG mark-up as a string.
     */
    function _buildSVG(ReputationData memory data) internal pure returns (string memory) {
        string memory scoreStr = uint256(data.trustScore).toString();
        string memory streakStr = uint256(data.repaymentStreak).toString();

        // Pick accent colour per tier
        string memory accentColour = _tierColour(data.tier);

        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="400" height="560">',

                // ── Definitions ────────────────────────────────────────────
                '<defs>',
                    '<radialGradient id="bg" cx="50%" cy="40%" r="70%">',
                        '<stop offset="0%" stop-color="#1a1a2e"/>',
                        '<stop offset="100%" stop-color="#0a0a12"/>',
                    '</radialGradient>',
                    '<radialGradient id="glow" cx="50%" cy="50%" r="50%">',
                        '<stop offset="0%" stop-color="', accentColour, '" stop-opacity="0.35"/>',
                        '<stop offset="100%" stop-color="', accentColour, '" stop-opacity="0"/>',
                    '</radialGradient>',
                    '<filter id="blur">',
                        '<feGaussianBlur stdDeviation="18"/>',
                    '</filter>',
                    '<linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
                        '<stop offset="0%" stop-color="', accentColour, '"/>',
                        '<stop offset="100%" stop-color="#ffffff" stop-opacity="0.4"/>',
                    '</linearGradient>',
                '</defs>',

                // ── Background ──────────────────────────────────────────────
                '<rect width="400" height="560" rx="24" fill="url(#bg)"/>',

                // ── Glow blob ───────────────────────────────────────────────
                '<circle cx="200" cy="210" r="130" fill="url(#glow)" filter="url(#blur)"/>',

                // ── Score ring ──────────────────────────────────────────────
                '<circle cx="200" cy="210" r="110" fill="none" stroke="url(#ringGrad)" stroke-width="3" opacity="0.6"/>',
                '<circle cx="200" cy="210" r="95"  fill="#0f0f1a" stroke="', accentColour, '" stroke-width="1.5" opacity="0.3"/>',

                // ── Score numeral ───────────────────────────────────────────
                '<text x="200" y="238"',
                '  font-family="\'Arial Black\', sans-serif"',
                '  font-size="80" font-weight="900"',
                '  fill="', accentColour, '"',
                '  text-anchor="middle"',
                '  dominant-baseline="middle">',
                scoreStr,
                '</text>',

                // ── "/100" sub-label ─────────────────────────────────────────
                '<text x="200" y="278"',
                '  font-family="Arial, sans-serif"',
                '  font-size="14" fill="', accentColour, '" opacity="0.55"',
                '  text-anchor="middle">/ 100</text>',

                // ── Tier badge ───────────────────────────────────────────────
                '<rect x="130" y="335" width="140" height="38" rx="19"',
                '  fill="none" stroke="', accentColour, '" stroke-width="1.5" opacity="0.7"/>',
                '<text x="200" y="359"',
                '  font-family="Arial, sans-serif"',
                '  font-size="18" font-weight="700"',
                '  fill="', accentColour, '"',
                '  text-anchor="middle"',
                '  letter-spacing="3">',
                _toUpperCase(data.tier),
                '</text>',

                // ── Stats row ────────────────────────────────────────────────
                '<text x="200" y="415"',
                '  font-family="Arial, sans-serif"',
                '  font-size="12" fill="#888" text-anchor="middle">',
                'LOANS REPAID &amp; STREAK',
                '</text>',
                '<text x="130" y="440"',
                '  font-family="Arial, sans-serif"',
                '  font-size="22" font-weight="700"',
                '  fill="#ffffff" text-anchor="middle">',
                data.loansRepaid.toString(),
                '</text>',
                '<text x="270" y="440"',
                '  font-family="Arial, sans-serif"',
                '  font-size="22" font-weight="700"',
                '  fill="', accentColour, '" text-anchor="middle">',
                streakStr, 'x',
                '</text>',
                '<text x="130" y="458" font-family="Arial,sans-serif" font-size="10" fill="#555" text-anchor="middle">loans</text>',
                '<text x="270" y="458" font-family="Arial,sans-serif" font-size="10" fill="#555" text-anchor="middle">streak</text>',

                // ── Archetype ────────────────────────────────────────────────
                '<text x="200" y="498"',
                '  font-family="Arial, sans-serif"',
                '  font-size="11" fill="#666" text-anchor="middle" letter-spacing="2">',
                _toUpperCase(data.earningArchetype), ' EARNER',
                '</text>',

                // ── Protocol name ────────────────────────────────────────────
                '<text x="200" y="535"',
                '  font-family="\'Arial Black\', sans-serif"',
                '  font-size="13" fill="', accentColour, '"',
                '  opacity="0.5" text-anchor="middle" letter-spacing="4">',
                'TRUSTLEND',
                '</text>',

                // ── Corner ornaments ─────────────────────────────────────────
                '<circle cx="30"  cy="30"  r="4" fill="', accentColour, '" opacity="0.25"/>',
                '<circle cx="370" cy="30"  r="4" fill="', accentColour, '" opacity="0.25"/>',
                '<circle cx="30"  cy="530" r="4" fill="', accentColour, '" opacity="0.25"/>',
                '<circle cx="370" cy="530" r="4" fill="', accentColour, '" opacity="0.25"/>',

                '</svg>'
            )
        );
    }

    /**
     * @dev Returns the hex accent colour for each tier.
     * @param tier Tier label string.
     * @return     Hex colour string (CSS-compatible).
     */
    function _tierColour(string memory tier) internal pure returns (string memory) {
        bytes32 h = keccak256(bytes(tier));
        if (h == keccak256(bytes("Gold")))   return "#FFD700";
        if (h == keccak256(bytes("Silver"))) return "#C0C0C0";
        if (h == keccak256(bytes("Bronze"))) return "#CD7F32";
        return "#8B8FA8"; // Entry — muted blue-grey
    }

    /**
     * @dev Naive toUpperCase for short ASCII tier/archetype strings.
     *      Only converts lowercase a-z; safe for the fixed set of values used here.
     * @param str Input string.
     * @return    Upper-cased string.
     */
    function _toUpperCase(string memory str) internal pure returns (string memory) {
        bytes memory b = bytes(str);
        bytes memory upper = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            upper[i] = (c >= 97 && c <= 122) ? bytes1(c - 32) : bytes1(c);
        }
        return string(upper);
    }
}
