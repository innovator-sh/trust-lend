// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @dev The functions of LendingPool that VouchSystem reads.
interface ILendingPoolView {
    function isLoanActive(address borrower) external view returns (bool);
    function loansRepaid(address wallet) external view returns (uint256);
}

/**
 * @title VouchSystem
 * @notice Peer vouching: users stake tokens to back a borrower's credibility.
 *
 * Flow:
 *  1. The voucher approves this contract to spend their tokens.
 *  2. The voucher calls stakeForBorrower(). The tokens lock in this contract.
 *  3. The borrower repays in full. LendingPool calls settleBorrower(borrower, false). Stakes return.
 *  4. The borrower defaults. LendingPool calls settleBorrower(borrower, true). Stakes go to the treasury.
 *  5. The borrower has no active loan. The voucher can take the stake back with reclaimStake().
 *
 * The owner can still call releaseStake() and slashStake() for manual cases.
 */
contract VouchSystem is Ownable2Step {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public treasury;     // receives slashed stake
    address public lendingPool;  // allowed to settle stakes
    uint256 public nextVouchId;

    /// @notice Smallest stake accepted (1 TRUST).
    uint256 public constant MIN_STAKE = 1e18;
    /// @notice Most unsettled vouches one borrower can have. This bounds the loops.
    uint256 public constant MAX_ACTIVE_VOUCHES_PER_BORROWER = 10;

    /// @notice Repaid loans a wallet needs before it can vouch. 0 means no limit.
    /// @dev    Set to 1 or more on a production network. Keep 0 for local demos.
    uint256 public minVoucherRepaidLoans;

    struct Vouch {
        uint256 id;
        address voucher;
        address borrower;
        uint256 amount;
        bool released;
        bool slashed;
    }

    mapping(uint256 => Vouch) public vouches;
    // borrower → IDs of vouches that are not settled yet
    mapping(address => uint256[]) public borrowerVouches;
    // voucher → cumulative staked amount (not settled)
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
    event LendingPoolSet(address indexed pool);
    event MinVoucherRepaidLoansSet(uint256 value);

    modifier onlyOwnerOrPool() {
        require(
            msg.sender == owner() || (lendingPool != address(0) && msg.sender == lendingPool),
            "VouchSystem: not owner or pool"
        );
        _;
    }

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
     * @param amount   Tokens to stake. Must be at least MIN_STAKE.
     * @return vouchId The ID of the created vouch record.
     */
    function stakeForBorrower(address borrower, uint256 amount) external returns (uint256) {
        require(amount >= MIN_STAKE,        "Stake below minimum");
        require(borrower != msg.sender,     "Cannot vouch for yourself");
        require(borrower != address(0),     "Invalid borrower address");
        require(
            borrowerVouches[borrower].length < MAX_ACTIVE_VOUCHES_PER_BORROWER,
            "Too many active vouches"
        );

        if (minVoucherRepaidLoans > 0) {
            require(lendingPool != address(0), "Pool not set");
            require(
                ILendingPoolView(lendingPool).loansRepaid(msg.sender) >= minVoucherRepaidLoans,
                "Voucher needs repaid loan history"
            );
        }

        token.safeTransferFrom(msg.sender, address(this), amount);

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

    /**
     * @notice The voucher takes back a stake while the borrower has no active loan.
     * @param vouchId Vouch record to reclaim.
     */
    function reclaimStake(uint256 vouchId) external {
        Vouch storage vouch = vouches[vouchId];
        require(vouch.voucher == msg.sender, "Not the voucher");
        require(!vouch.released && !vouch.slashed, "Vouch already settled");
        require(lendingPool != address(0), "Pool not set");
        require(
            !ILendingPoolView(lendingPool).isLoanActive(vouch.borrower),
            "Borrower has an active loan"
        );
        _settle(vouchId, false);
    }

    /* ──────────────────────────────────────
       SETTLEMENT (owner or LendingPool)
    ────────────────────────────────────── */

    /**
     * @notice Release one stake back to the voucher.
     * @param vouchId Vouch record to release.
     */
    function releaseStake(uint256 vouchId) external onlyOwnerOrPool {
        _settle(vouchId, false);
    }

    /**
     * @notice Slash one stake. The tokens go to the treasury.
     * @param vouchId Vouch record to slash.
     */
    function slashStake(uint256 vouchId) external onlyOwnerOrPool {
        _settle(vouchId, true);
    }

    /**
     * @notice Settle every unsettled vouch of a borrower in one call.
     * @param borrower The borrower whose loan ended.
     * @param slash    true after a default, false after full repayment.
     */
    function settleBorrower(address borrower, bool slash) external onlyOwnerOrPool {
        // _settle removes the ID from the array, so always take the last element.
        while (borrowerVouches[borrower].length > 0) {
            uint256[] storage ids = borrowerVouches[borrower];
            _settle(ids[ids.length - 1], slash);
        }
    }

    /* ──────────────────────────────────────
       ADMIN FUNCTIONS
    ────────────────────────────────────── */

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
    }

    function setLendingPool(address _pool) external onlyOwner {
        require(_pool != address(0), "Invalid address");
        lendingPool = _pool;
        emit LendingPoolSet(_pool);
    }

    function setMinVoucherRepaidLoans(uint256 value) external onlyOwner {
        minVoucherRepaidLoans = value;
        emit MinVoucherRepaidLoansSet(value);
    }

    /* ──────────────────────────────────────
       INTERNAL
    ────────────────────────────────────── */

    function _settle(uint256 vouchId, bool slash) internal {
        Vouch storage vouch = vouches[vouchId];
        require(vouch.voucher != address(0), "Vouch does not exist");
        require(!vouch.released && !vouch.slashed, "Vouch already settled");

        totalStakedBy[vouch.voucher] -= vouch.amount;
        _removeFromBorrower(vouch.borrower, vouchId);

        if (slash) {
            vouch.slashed = true;
            token.safeTransfer(treasury, vouch.amount);
            emit VouchSlashed(vouchId, vouch.voucher, vouch.amount);
        } else {
            vouch.released = true;
            token.safeTransfer(vouch.voucher, vouch.amount);
            emit VouchReleased(vouchId, vouch.voucher, vouch.amount);
        }
    }

    function _removeFromBorrower(address borrower, uint256 vouchId) internal {
        uint256[] storage ids = borrowerVouches[borrower];
        uint256 len = ids.length;
        for (uint256 i = 0; i < len; i++) {
            if (ids[i] == vouchId) {
                ids[i] = ids[len - 1];
                ids.pop();
                return;
            }
        }
    }

    /* ──────────────────────────────────────
       VIEW FUNCTIONS
    ────────────────────────────────────── */

    function getVouch(uint256 vouchId) external view returns (Vouch memory) {
        return vouches[vouchId];
    }

    /// @notice IDs of the vouches that are not settled yet.
    function getBorrowerVouches(address borrower) external view returns (uint256[] memory) {
        return borrowerVouches[borrower];
    }

    /**
     * @notice Total active (unsettled) stake backing a borrower.
     */
    function getTotalActiveStake(address borrower) external view returns (uint256 total) {
        uint256[] memory ids = borrowerVouches[borrower];
        for (uint256 i = 0; i < ids.length; i++) {
            total += vouches[ids[i]].amount;
        }
    }
}
