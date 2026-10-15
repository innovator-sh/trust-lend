// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VouchSystem
 * @notice Peer vouching: users stake tokens to back a borrower's credibility.
 *
 * Flow:
 *  1. Voucher approves this contract to spend their tokens.
 *  2. Voucher calls stakeForBorrower() → tokens lock in contract.
 *  3. On repayment → owner calls releaseStake() → tokens returned to voucher.
 *  4. On default   → owner calls slashStake() → tokens sent to treasury.
 */
contract VouchSystem is Ownable {
    IERC20 public token;
    address public treasury;     // receives slashed stake
    uint256 public nextVouchId;

    struct Vouch {
        uint256 id;
        address voucher;
        address borrower;
        uint256 amount;
        bool released;
        bool slashed;
    }

    mapping(uint256 => Vouch) public vouches;
    // borrower → all vouch IDs backing them
    mapping(address => uint256[]) public borrowerVouches;
    // voucher → cumulative staked amount
    mapping(address => uint256) public totalStakedBy;

    /* ── Events ── */
    event VouchStaked(
        uint256 indexed vouchId,
        address indexed voucher,
        address indexed borrower,
        uint256 amount
    );
    event VouchReleased(uint256 indexed vouchId, address indexed voucher, uint256 amount);
    event VouchSlashed(uint256 indexed vouchId, address indexed voucher, uint256 amount);

    constructor(address _token, address _treasury) Ownable(msg.sender) {
        require(_token    != address(0), "Invalid token address");
        require(_treasury != address(0), "Invalid treasury address");
        token    = IERC20(_token);
        treasury = _treasury;
    }

    /* ──────────────────────────────────────
       VOUCHER FUNCTIONS
    ────────────────────────────────────── */

    /**
     * @notice Stake tokens on behalf of a borrower.
     * @param borrower Address of the borrower you are backing.
     * @param amount   Number of TLD tokens to stake.
     * @return vouchId The ID of the created vouch record.
     */
    function stakeForBorrower(address borrower, uint256 amount) external returns (uint256) {
        require(amount > 0,                 "Stake must be greater than 0");
        require(borrower != msg.sender,     "Cannot vouch for yourself");
        require(borrower != address(0),     "Invalid borrower address");

        require(token.transferFrom(msg.sender, address(this), amount), "Token transfer failed");

        uint256 vouchId = nextVouchId;
        nextVouchId++;

        vouches[vouchId] = Vouch({
            id:       vouchId,
            voucher:  msg.sender,
            borrower: borrower,
            amount:   amount,
            released: false,
            slashed:  false
        });

        borrowerVouches[borrower].push(vouchId);
        totalStakedBy[msg.sender] += amount;

        emit VouchStaked(vouchId, msg.sender, borrower, amount);
        return vouchId;
    }

    /* ──────────────────────────────────────
       ADMIN FUNCTIONS
    ────────────────────────────────────── */

    /**
     * @notice Release staked tokens back to voucher (called after loan repayment).
     * @param vouchId Vouch record to release.
     */
    function releaseStake(uint256 vouchId) external onlyOwner {
        Vouch storage vouch = vouches[vouchId];
        require(!vouch.released && !vouch.slashed, "Vouch already settled");

        vouch.released = true;
        totalStakedBy[vouch.voucher] -= vouch.amount;

        require(token.transfer(vouch.voucher, vouch.amount), "Release transfer failed");

        emit VouchReleased(vouchId, vouch.voucher, vouch.amount);
    }

    /**
     * @notice Slash staked tokens (called after loan default). Sends to treasury.
     * @param vouchId Vouch record to slash.
     */
    function slashStake(uint256 vouchId) external onlyOwner {
        Vouch storage vouch = vouches[vouchId];
        require(!vouch.released && !vouch.slashed, "Vouch already settled");

        vouch.slashed = true;
        totalStakedBy[vouch.voucher] -= vouch.amount;

        require(token.transfer(treasury, vouch.amount), "Slash transfer failed");

        emit VouchSlashed(vouchId, vouch.voucher, vouch.amount);
    }

    /**
     * @notice Update treasury address.
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
    }

    /* ──────────────────────────────────────
       VIEW FUNCTIONS
    ────────────────────────────────────── */

    function getVouch(uint256 vouchId) external view returns (Vouch memory) {
        return vouches[vouchId];
    }

    function getBorrowerVouches(address borrower) external view returns (uint256[] memory) {
        return borrowerVouches[borrower];
    }

    /**
     * @notice Total active (unreleased, unslashed) stake backing a borrower.
     */
    function getTotalActiveStake(address borrower) external view returns (uint256 total) {
        uint256[] memory ids = borrowerVouches[borrower];
        for (uint256 i = 0; i < ids.length; i++) {
            Vouch storage v = vouches[ids[i]];
            if (!v.released && !v.slashed) {
                total += v.amount;
            }
        }
    }
}
