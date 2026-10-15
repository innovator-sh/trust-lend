// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TrustToken
 * @notice ERC-20 token for the TrustLend micro-lending platform on Polygon Amoy.
 *
 *  - Name:           TrustLend Token
 *  - Symbol:         TRUST
 *  - Decimals:       18
 *  - Initial Supply: 1,000,000 TRUST minted to deployer
 *  - Faucet:         Anyone can claim 1,000 TRUST every 24 hours
 *  - Owner mint:     Deployer can mint more for top-ups
 */
contract TrustToken is ERC20, Ownable {
    /* ── Faucet config ── */
    uint256 public constant FAUCET_AMOUNT   = 1_000 * 1e18;  // 1,000 TRUST
    uint256 public constant FAUCET_COOLDOWN = 24 hours;

    /// @notice Last claim timestamp per wallet
    mapping(address => uint256) public lastClaimed;

    /* ── Events ── */
    event TokensClaimed(address indexed claimer, uint256 amount, uint256 timestamp);

    /* ── Constructor ── */
    constructor() ERC20("TrustLend Token", "TRUST") Ownable(msg.sender) {
        // Mint 1,000,000 TRUST to deployer
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    /* ── Faucet ── */

    /**
     * @notice Claim 1,000 TRUST test tokens. Callable once every 24 hours.
     * @dev    Perfect for hackathon demos — judges can get tokens themselves.
     */
    function claimTestTokens() external {
        require(
            block.timestamp >= lastClaimed[msg.sender] + FAUCET_COOLDOWN,
            "TrustToken: wait 24h between claims"
        );

        lastClaimed[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);

        emit TokensClaimed(msg.sender, FAUCET_AMOUNT, block.timestamp);
    }

    /**
     * @notice How many seconds until the caller can claim again.
     * @return 0 if claimable now, otherwise seconds remaining.
     */
    function timeUntilNextClaim(address account) external view returns (uint256) {
        uint256 nextTime = lastClaimed[account] + FAUCET_COOLDOWN;
        if (block.timestamp >= nextTime) return 0;
        return nextTime - block.timestamp;
    }

    /* ── Owner-only mint ── */

    /**
     * @notice Owner mints additional tokens (for pool seeding, test accounts, etc.)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
