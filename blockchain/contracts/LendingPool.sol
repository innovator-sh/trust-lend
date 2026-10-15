// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./ReputationNFT.sol";

/**
 * @title LendingPool
 * @author TrustLend Team
 * @notice Core lending contract for TrustLend — a decentralised micro-lending
 *         platform on Polygon Amoy. Manages pool liquidity, borrower loans,
 *         trust-score-gated limits, interest accrual, and auto-scoring on repayment.
 *
 * @dev Architecture
 *  ┌──────────┐   depositToPool()   ┌──────────┐   requestLoan()   ┌──────────┐
 *  │  Lender  │ ──────────────────▶ │   Pool   │ ─────────────────▶│ Borrower │
 *  └──────────┘                     └──────────┘                    └──────────┘
 *       ▲                                ▲                               │
 *       │  withdrawFromPool()            │  makeRepayment()              │
 *       └────────────────────────────────┘◀──────────────────────────────┘
 *
 * Key features:
 *  • Trust-score-gated borrow limits (30–100 → $10–$500)
 *  • Three loan paths with path-specific interest rates
 *  • Automatic trust score adjustments on repayment
 *  • Proportional yield distribution to lenders
 *  • ReentrancyGuard + Pausable safety
 */
contract LendingPool is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /* ══════════════════════════════════════════
       ENUMS
    ═══════════════════════════════════════════ */

    /// @notice Loan lifecycle status.
    enum LoanStatus { Active, Repaid, Defaulted, Liquidated }

    /// @notice Determines interest rate applied to the loan.
    enum LoanPath  { VouchBacked, Collateral, TrustOnly }

    /* ══════════════════════════════════════════
       STRUCTS
    ═══════════════════════════════════════════ */

    /// @notice Full loan record for a borrower.
    struct Loan {
        address    borrower;
        uint256    amount;            // principal in TRUST (18 dec)
        uint256    repaidAmount;      // total TRUST repaid so far
        uint256    interestRate;      // basis points (e.g. 500 = 5%)
        uint256    startTime;         // block.timestamp at disbursal
        uint256    dueDate;           // startTime + durationDays
        uint8      installmentsPaid;  // repayment count
        uint8      totalInstallments; // how many equal payments expected
        LoanStatus status;
        LoanPath   path;
    }

    /* ══════════════════════════════════════════
       STATE
    ═══════════════════════════════════════════ */

    /// @notice The TRUST ERC-20 token used for all pool operations.
    IERC20 public immutable trustToken;

    /// @notice The heart of our reputation identity — the soulbound NFT.
    address public reputationNFT;

    /// @dev borrower → active Loan (one active loan per borrower)
    mapping(address => Loan) private _loans;

    /// @dev lender → principal deposited (before yield)
    mapping(address => uint256) public lenderDeposits;

    /// @dev borrower → on-chain trust score (0–100)
    mapping(address => uint8)   public trustScores;

    /// @notice Sum of all lender deposits currently in the pool (excl. active loans).
    uint256 public totalPoolLiquidity;

    /// @notice Number of loans currently in Active status.
    uint256 public totalActiveLoans;

    /// @notice Running count of all unique lenders who deposited ≥ once.
    uint256 public totalLenders;

    /// @notice Sum of all interest rates across active loans (for avg calc).
    uint256 private _activeInterestSum;

    /// @dev tracks first-time lenders
    mapping(address => bool) private _hasDeposited;

    /* ══════════════════════════════════════════
       CONSTANTS
    ═══════════════════════════════════════════ */

    /// @dev Basis-point interest rates per path
    uint256 private constant RATE_VOUCH      = 420;   // 4.2%
    uint256 private constant RATE_COLLATERAL = 280;   // 2.8%
    uint256 private constant RATE_TRUST_ONLY = 710;   // 7.1%

    /// @dev Trust score bands → maximum borrow amounts (in TRUST, 18 decimals)
    uint256 private constant LIMIT_ENTRY    = 10   * 1e18;  // score 30-39
    uint256 private constant LIMIT_BRONZE   = 50   * 1e18;  // score 40-59
    uint256 private constant LIMIT_SILVER   = 200  * 1e18;  // score 60-79
    uint256 private constant LIMIT_GOLD     = 500  * 1e18;  // score 80-100

    /// @dev Default number of equal installments per loan
    uint8 private constant DEFAULT_INSTALLMENTS = 4;

    /// @dev Score adjustments on repayment
    uint8 private constant SCORE_ONTIME = 8;
    uint8 private constant SCORE_EARLY  = 12;
    uint8 private constant SCORE_LATE   = 3;

    /// @dev Maximum trust score ceiling
    uint8 private constant MAX_SCORE = 100;

    /* ══════════════════════════════════════════
       EVENTS
    ═══════════════════════════════════════════ */

    /// @notice Emitted when a lender deposits TRUST into the pool.
    event PoolDeposit(
        address indexed lender,
        uint256 amount,
        uint256 newTotal
    );

    /// @notice Emitted when a lender withdraws TRUST from the pool.
    event PoolWithdrawal(
        address indexed lender,
        uint256 amount,
        uint256 yieldEarned
    );

    /// @notice Emitted when a loan is created and funds disbursed.
    event LoanDisbursed(
        address indexed borrower,
        uint256 amount,
        uint256 dueDate,
        LoanPath path
    );

    /// @notice Emitted for each repayment (partial or full).
    event RepaymentMade(
        address indexed borrower,
        uint256 amount,
        uint256 remaining,
        uint8   newTrustScore
    );

    /// @notice Emitted when a trust score is updated (by owner or internally).
    event TrustScoreUpdated(
        address indexed borrower,
        uint8   oldScore,
        uint8   newScore
    );

    /// @notice Emitted when a loan is marked as defaulted.
    event LoanDefaulted(
        address indexed borrower,
        uint256 amount,
        uint256 outstandingDebt
    );

    /* ══════════════════════════════════════════
       CONSTRUCTOR
    ═══════════════════════════════════════════ */

    /**
     * @notice Deploy the LendingPool tied to a specific TRUST token.
     * @param _trustToken Address of the TrustToken ERC-20 contract.
     * @param _reputationNFT Address of the ReputationNFT contract.
     */
    constructor(address _trustToken, address _reputationNFT) Ownable(msg.sender) {
        require(_trustToken != address(0), "LendingPool: zero token address");
        require(_reputationNFT != address(0), "LendingPool: zero NFT address");
        trustToken = IERC20(_trustToken);
        reputationNFT = _reputationNFT;
    }

    /* ══════════════════════════════════════════
       LENDER FUNCTIONS
    ═══════════════════════════════════════════ */

    /**
     * @notice Deposit TRUST tokens into the lending pool.
     * @dev    Caller must first `approve` this contract for `amount`.
     * @param  amount Amount of TRUST to deposit (18 decimals).
     *
     * Emits {PoolDeposit}.
     */
    function depositToPool(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "LendingPool: zero deposit");

        trustToken.safeTransferFrom(msg.sender, address(this), amount);

        lenderDeposits[msg.sender] += amount;
        totalPoolLiquidity += amount;

        if (!_hasDeposited[msg.sender]) {
            _hasDeposited[msg.sender] = true;
            totalLenders++;
        }

        emit PoolDeposit(msg.sender, amount, totalPoolLiquidity);
    }

    /**
     * @notice Withdraw deposited TRUST from the pool.
     * @dev    Withdrawal is limited to the pool's available (non-loaned) liquidity.
     *         Yield is calculated as a proportional share of interest earnings held
     *         by the contract above totalPoolLiquidity.
     * @param  amount Principal amount to withdraw.
     *
     * Emits {PoolWithdrawal}.
     */
    function withdrawFromPool(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "LendingPool: zero withdrawal");
        require(lenderDeposits[msg.sender] >= amount, "LendingPool: exceeds deposit");
        require(totalPoolLiquidity >= amount, "LendingPool: insufficient free liquidity");

        // Calculate yield: proportional share of contract's surplus over pool deposits
        uint256 contractBalance = trustToken.balanceOf(address(this));
        uint256 yieldEarned = 0;
        if (contractBalance > totalPoolLiquidity && totalPoolLiquidity > 0) {
            uint256 surplus = contractBalance - totalPoolLiquidity;
            yieldEarned = (surplus * amount) / totalPoolLiquidity;
        }

        lenderDeposits[msg.sender] -= amount;
        totalPoolLiquidity -= amount;

        uint256 totalPayout = amount + yieldEarned;
        trustToken.safeTransfer(msg.sender, totalPayout);

        emit PoolWithdrawal(msg.sender, amount, yieldEarned);
    }

    /* ══════════════════════════════════════════
       BORROWER FUNCTIONS
    ═══════════════════════════════════════════ */

    /**
     * @notice Request a loan. Funds are immediately disbursed if all checks pass.
     * @dev    - Borrower must NOT have an existing Active loan.
     *         - Amount must be within the borrower's trust-score-based limit.
     *         - Pool must have sufficient free liquidity.
     *         Interest rate is determined by the chosen `path`.
     * @param  amount       Loan principal in TRUST (18 decimals).
     * @param  durationDays Loan term in days.
     * @param  path         0 = VouchBacked, 1 = Collateral, 2 = TrustOnly.
     *
     * Emits {LoanDisbursed}.
     */
    function requestLoan(
        uint256 amount,
        uint256 durationDays,
        uint8   path
    ) external nonReentrant whenNotPaused {
        require(amount > 0, "LendingPool: zero amount");
        require(durationDays > 0 && durationDays <= 365, "LendingPool: invalid duration");
        require(path <= uint8(LoanPath.TrustOnly), "LendingPool: invalid path");

        // One active loan per borrower
        require(
            _loans[msg.sender].status != LoanStatus.Active,
            "LendingPool: active loan exists"
        );

        // Trust-score-gated limit
        uint256 limit = getBorrowLimit(msg.sender);
        require(amount <= limit, "LendingPool: exceeds trust limit");

        // Pool liquidity check
        require(totalPoolLiquidity >= amount, "LendingPool: insufficient pool liquidity");

        // Determine interest rate
        LoanPath loanPath = LoanPath(path);
        uint256 rate = _rateForPath(loanPath);

        // Build loan
        uint256 dueDate = block.timestamp + (durationDays * 1 days);
        _loans[msg.sender] = Loan({
            borrower:          msg.sender,
            amount:            amount,
            repaidAmount:      0,
            interestRate:      rate,
            startTime:         block.timestamp,
            dueDate:           dueDate,
            installmentsPaid:  0,
            totalInstallments: DEFAULT_INSTALLMENTS,
            status:            LoanStatus.Active,
            path:              loanPath
        });

        totalPoolLiquidity -= amount;
        totalActiveLoans++;
        _activeInterestSum += rate;

        // Disburse
        trustToken.safeTransfer(msg.sender, amount);

        emit LoanDisbursed(msg.sender, amount, dueDate, loanPath);
    }

    /**
     * @notice Repay part or all of an active loan.
     * @dev    On full repayment the loan is marked Repaid and `_increaseTrustScore`
     *         is called to reward the borrower. Interest gained stays in the pool
     *         and is distributed proportionally to lenders on withdrawal.
     * @param  amount TRUST tokens to repay (caller must have approved this contract).
     *
     * Emits {RepaymentMade}.
     */
    function makeRepayment(uint256 amount) external nonReentrant whenNotPaused {
        Loan storage loan = _loans[msg.sender];
        require(loan.status == LoanStatus.Active, "LendingPool: no active loan");
        require(amount > 0, "LendingPool: zero repayment");

        // Total owed = principal + interest
        uint256 totalOwed = _totalOwed(loan);
        uint256 remaining = totalOwed - loan.repaidAmount;
        require(amount <= remaining, "LendingPool: overpayment");

        // Pull tokens
        trustToken.safeTransferFrom(msg.sender, address(this), amount);

        loan.repaidAmount += amount;
        loan.installmentsPaid++;

        // Return principal portion to pool liquidity
        // (interest stays in the contract as yield for lenders)
        uint256 principalPortion = (amount * loan.amount) / totalOwed;
        totalPoolLiquidity += principalPortion;

        // Check if fully repaid
        if (loan.repaidAmount >= totalOwed) {
            loan.status = LoanStatus.Repaid;
            totalActiveLoans--;
            _activeInterestSum -= loan.interestRate;
            _increaseTrustScore(msg.sender);
        }

        uint8 currentScore = trustScores[msg.sender];
        remaining = totalOwed - loan.repaidAmount;

        emit RepaymentMade(msg.sender, amount, remaining, currentScore);
    }

    /* ══════════════════════════════════════════
       ADMIN FUNCTIONS
    ═══════════════════════════════════════════ */

    /**
     * @notice Owner updates a borrower's trust score.
     * @dev    Called by the off-chain AI backend after risk assessment.
     * @param  borrower The address to update.
     * @param  newScore The new trust score (0–100).
     *
     * Emits {TrustScoreUpdated}.
     */
    function updateTrustScore(address borrower, uint8 newScore)
        external
        onlyOwner
    {
        require(borrower != address(0), "LendingPool: zero address");
        require(newScore <= MAX_SCORE, "LendingPool: score > 100");

        uint8 oldScore = trustScores[borrower];
        trustScores[borrower] = newScore;

        emit TrustScoreUpdated(borrower, oldScore, newScore);
    }

    /**
     * @notice Owner marks an active loan as defaulted.
     * @dev    Typically called when dueDate has passed and no repayment was made.
     *         Does NOT slash vouches — that is handled separately in VouchSystem.
     * @param  borrower Address of the defaulting borrower.
     *
     * Emits {LoanDefaulted}.
     */
    function markDefault(address borrower) external onlyOwner {
        Loan storage loan = _loans[borrower];
        require(loan.status == LoanStatus.Active, "LendingPool: not active");

        loan.status = LoanStatus.Defaulted;
        totalActiveLoans--;
        _activeInterestSum -= loan.interestRate;

        // Decrease trust score by 15 (floor at 0)
        uint8 oldScore = trustScores[borrower];
        uint8 penalty  = oldScore >= 15 ? oldScore - 15 : 0;
        trustScores[borrower] = penalty;

        // Sync with Reputation NFT
        try ReputationNFT(reputationNFT).updateReputation(borrower, penalty, loan.amount, false) {} catch {}

        uint256 outstanding = _totalOwed(loan) - loan.repaidAmount;

        emit LoanDefaulted(borrower, loan.amount, outstanding);
        emit TrustScoreUpdated(borrower, oldScore, penalty);
    }

    function mintReputationNFT(address to) external onlyOwner {
        ReputationNFT(reputationNFT).mintReputationNFT(to);
    }

    /**
     * @notice Pause all state-changing operations (emergency stop).
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause operations.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /* ══════════════════════════════════════════
       INTERNAL HELPERS
    ═══════════════════════════════════════════ */

    /**
     * @dev Adjusts the borrower's trust score after full repayment.
     *      - Early repayment (before 75% of term):  +12
     *      - On-time (before dueDate):               +8
     *      - Late (after dueDate):                    +3
     *      Capped at MAX_SCORE (100).
     */
    function _increaseTrustScore(address borrower) internal {
        Loan storage loan = _loans[borrower];
        uint8 oldScore = trustScores[borrower];

        uint8 bump;
        if (block.timestamp <= loan.startTime + ((loan.dueDate - loan.startTime) * 75) / 100) {
            // Repaid before 75% of term → "early"
            bump = SCORE_EARLY;
        } else if (block.timestamp <= loan.dueDate) {
            // Repaid before due date → "on-time"
            bump = SCORE_ONTIME;
        } else {
            // Repaid after due date → "late but repaid"
            bump = SCORE_LATE;
        }

        uint8 newScore = oldScore + bump > MAX_SCORE ? MAX_SCORE : oldScore + bump;
        trustScores[borrower] = newScore;

        // NEW: Update the Reputation NFT (soulbound identity)
        try ReputationNFT(reputationNFT).updateReputation(borrower, newScore, loan.amount, bump >= SCORE_ONTIME) {} catch {}

        emit TrustScoreUpdated(borrower, oldScore, newScore);
    }

    /**
     * @dev Total amount owed = principal + (principal × rate / 10000).
     */
    function _totalOwed(Loan storage loan) internal view returns (uint256) {
        return loan.amount + (loan.amount * loan.interestRate) / 10_000;
    }

    /**
     * @dev Returns the basis-point interest rate for a given path.
     */
    function _rateForPath(LoanPath p) internal pure returns (uint256) {
        if (p == LoanPath.VouchBacked) return RATE_VOUCH;
        if (p == LoanPath.Collateral)  return RATE_COLLATERAL;
        return RATE_TRUST_ONLY;
    }

    /* ══════════════════════════════════════════
       VIEW FUNCTIONS
    ═══════════════════════════════════════════ */

    /**
     * @notice Returns the full Loan struct for a borrower.
     * @param  borrower Address to query.
     * @return loan     The borrower's current/last loan.
     */
    function getLoan(address borrower) external view returns (Loan memory) {
        return _loans[borrower];
    }

    /**
     * @notice Returns a borrower's on-chain trust score.
     * @param  borrower Address to query.
     * @return score    0–100 trust score.
     */
    function getTrustScore(address borrower) external view returns (uint8) {
        return trustScores[borrower];
    }

    /**
     * @notice Returns the TRUST token balance held by this contract.
     * @return balance Includes pool liquidity + locked repayment interest.
     */
    function getPoolBalance() external view returns (uint256) {
        return trustToken.balanceOf(address(this));
    }

    /**
     * @notice Returns the principal a lender has deposited.
     * @param  lender Address to query.
     * @return deposited Amount of TRUST deposited.
     */
    function getLenderBalance(address lender) external view returns (uint256) {
        return lenderDeposits[lender];
    }

    /**
     * @notice Returns the maximum loan amount a borrower is eligible for,
     *         based on their trust score.
     * @param  borrower Address to query.
     * @return limit    Max borrow amount in TRUST (18 decimals).
     */
    function getBorrowLimit(address borrower) public view returns (uint256) {
        uint8 score = trustScores[borrower];
        if (score >= 80) return LIMIT_GOLD;
        if (score >= 60) return LIMIT_SILVER;
        if (score >= 40) return LIMIT_BRONZE;
        return LIMIT_ENTRY;
    }

    /**
     * @notice Returns aggregate pool statistics.
     * @return liquidity       Free TRUST available for new loans.
     * @return activeLoans     Number of loans in Active status.
     * @return lenderCount     Unique lender count.
     * @return avgInterestRate Weighted-average interest rate in basis points
     *                         across active loans (0 if no active loans).
     */
    function getPoolStats()
        external
        view
        returns (
            uint256 liquidity,
            uint256 activeLoans,
            uint256 lenderCount,
            uint256 avgInterestRate
        )
    {
        liquidity       = totalPoolLiquidity;
        activeLoans     = totalActiveLoans;
        lenderCount     = totalLenders;
        avgInterestRate = totalActiveLoans > 0
            ? _activeInterestSum / totalActiveLoans
            : 0;
    }

    /**
     * @notice Returns total amount owed on a borrower's active loan
     *         (principal + interest).
     * @param  borrower Address to query.
     * @return owed Total owed, or 0 if no active loan.
     */
    function getTotalOwed(address borrower) external view returns (uint256) {
        Loan storage loan = _loans[borrower];
        if (loan.status != LoanStatus.Active) return 0;
        return _totalOwed(loan);
    }

    /**
     * @notice Returns remaining balance on a borrower's active loan.
     * @param  borrower Address to query.
     * @return remaining Amount still to be repaid.
     */
    function getRemainingDebt(address borrower) external view returns (uint256) {
        Loan storage loan = _loans[borrower];
        if (loan.status != LoanStatus.Active) return 0;
        uint256 owed = _totalOwed(loan);
        return owed > loan.repaidAmount ? owed - loan.repaidAmount : 0;
    }
}
