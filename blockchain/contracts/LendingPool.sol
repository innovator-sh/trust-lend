// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./ReputationNFT.sol";

/// @dev The functions of VouchSystem that LendingPool uses.
interface IVouchSystem {
    function getTotalActiveStake(address borrower) external view returns (uint256);
    function settleBorrower(address borrower, bool slash) external;
}

/**
 * @title LendingPool
 * @author TrustLend Team
 * @notice Core lending contract for TrustLend, a decentralised micro-lending
 *         platform on Polygon Amoy. It manages pool liquidity, borrower loans,
 *         trust-score-gated limits, interest and automatic scoring on repayment.
 *
 * @dev Pool accounting (shares)
 *  - Lenders own shares of the pool. Pool value = free liquidity + principal on loan.
 *  - Repaid interest raises the pool value. Each share is then worth more (lender yield).
 *  - A default removes the unpaid principal from the pool value. All lenders share the loss.
 *  - Tokens sent straight to the contract are NOT counted. They cannot be claimed as yield.
 *    Use depositToPool() to add liquidity, or addRecovery() to add value for all lenders.
 *
 * @dev Loan rules
 *  - One active loan per borrower. A defaulted loan must be repaid before a new loan.
 *  - A new wallet starts at INITIAL_SCORE on its first loan request.
 *  - A wallet with a score below MIN_BORROW_SCORE cannot borrow.
 *  - A repayment inside MIN_BONUS_AGE of the loan start gives no score bonus.
 *  - markDefault() works only after the due date.
 */
contract LendingPool is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /* ══════════════════════════════════════════
       ENUMS
    ═══════════════════════════════════════════ */

    /// @notice Loan lifecycle status. Value 0 is also the default of an empty record,
    ///         so always check `amount > 0` together with the status.
    enum LoanStatus { Active, Repaid, Defaulted, Liquidated }

    /// @notice Determines interest rate applied to the loan.
    /// @dev    Collateral is reserved. It is not available because no collateral logic exists.
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

    /// @notice The soulbound reputation NFT.
    address public reputationNFT;

    /// @notice The vouch staking contract.
    address public vouchSystem;

    /// @dev borrower → latest loan
    mapping(address => Loan) private _loans;

    /// @notice lender → principal still invested (cost basis, before yield)
    mapping(address => uint256) public lenderDeposits;

    /// @notice lender → pool shares
    mapping(address => uint256) public lenderShares;

    /// @notice Sum of all lender shares.
    uint256 public totalShares;

    /// @dev borrower → on-chain trust score (0–100)
    mapping(address => uint8)   public trustScores;

    /// @notice true after a wallet got its starting score and NFT.
    mapping(address => bool)    public registered;

    /// @notice Number of loans a wallet repaid in full.
    mapping(address => uint256) public loansRepaid;

    /// @notice Free TRUST in the pool. It can be lent or withdrawn now.
    uint256 public totalPoolLiquidity;

    /// @notice Principal that active loans still owe to the pool.
    uint256 public totalLoaned;

    /// @notice Number of loans currently in Active status.
    uint256 public totalActiveLoans;

    /// @notice Running count of all unique lenders who deposited at least once.
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
    uint256 private constant RATE_COLLATERAL = 280;   // 2.8% (path not available)
    uint256 private constant RATE_TRUST_ONLY = 710;   // 7.1%

    /// @dev Trust score bands → maximum borrow amounts (in TRUST, 18 decimals)
    uint256 private constant LIMIT_ENTRY    = 10   * 1e18;  // score 20-39
    uint256 private constant LIMIT_BRONZE   = 50   * 1e18;  // score 40-59
    uint256 private constant LIMIT_SILVER   = 200  * 1e18;  // score 60-79
    uint256 private constant LIMIT_GOLD     = 500  * 1e18;  // score 80-100

    /// @dev Default number of equal installments per loan (informational)
    uint8 private constant DEFAULT_INSTALLMENTS = 4;

    /// @dev Score adjustments
    uint8 private constant SCORE_ONTIME = 8;
    uint8 private constant SCORE_EARLY  = 12;
    uint8 private constant SCORE_LATE   = 3;
    uint8 private constant SCORE_DEFAULT_PENALTY = 15;

    /// @dev Maximum trust score ceiling
    uint8 private constant MAX_SCORE = 100;

    /// @notice Score of a wallet on its first loan request.
    uint8 public constant INITIAL_SCORE = 30;

    /// @notice A wallet below this score cannot borrow.
    uint8 public constant MIN_BORROW_SCORE = 20;

    /// @notice A repayment sooner than this after the loan start gives no score bonus.
    uint256 public constant MIN_BONUS_AGE = 1 days;

    /// @notice Active vouch stake a VouchBacked loan needs (5 TRUST).
    uint256 public constant MIN_VOUCH_STAKE_FOR_LOAN = 5 * 1e18;

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

    /// @notice Emitted when a default removes unpaid principal from the pool value.
    event LossRealized(address indexed borrower, uint256 principalLost);

    /// @notice Emitted when value is added to the pool without new shares.
    event RecoveryAdded(address indexed from, uint256 amount);

    /// @notice Emitted when a wallet gets its starting score.
    event BorrowerRegistered(address indexed wallet, uint8 score);

    /// @notice Emitted when the NFT could not be updated. The pool score is still correct.
    event ReputationSyncFailed(address indexed wallet);

    /// @notice Emitted when the vouch stakes could not be settled.
    event VouchSettleFailed(address indexed borrower, bool slash);

    /* ══════════════════════════════════════════
       CONSTRUCTOR
    ═══════════════════════════════════════════ */

    /**
     * @notice Deploy the LendingPool tied to a TRUST token, a reputation NFT and a vouch contract.
     * @param _trustToken    Address of the TrustToken ERC-20 contract.
     * @param _reputationNFT Address of the ReputationNFT contract.
     * @param _vouchSystem   Address of the VouchSystem contract.
     */
    constructor(address _trustToken, address _reputationNFT, address _vouchSystem) Ownable(msg.sender) {
        require(_trustToken != address(0), "LendingPool: zero token address");
        require(_reputationNFT != address(0), "LendingPool: zero NFT address");
        require(_vouchSystem != address(0), "LendingPool: zero vouch address");
        trustToken = IERC20(_trustToken);
        reputationNFT = _reputationNFT;
        vouchSystem = _vouchSystem;
    }

    /* ══════════════════════════════════════════
       LENDER FUNCTIONS
    ═══════════════════════════════════════════ */

    /**
     * @notice Deposit TRUST tokens into the lending pool.
     * @dev    Caller must first `approve` this contract for `amount`.
     *         The caller gets shares in proportion to the current pool value.
     * @param  amount Amount of TRUST to deposit (18 decimals).
     *
     * Emits {PoolDeposit}.
     */
    function depositToPool(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "LendingPool: zero deposit");

        uint256 value = _poolValue();
        uint256 minted;
        if (totalShares == 0) {
            minted = amount;
        } else {
            require(value > 0, "LendingPool: pool has no value");
            minted = (amount * totalShares) / value;
            require(minted > 0, "LendingPool: deposit too small");
        }

        trustToken.safeTransferFrom(msg.sender, address(this), amount);

        lenderShares[msg.sender] += minted;
        totalShares += minted;
        lenderDeposits[msg.sender] += amount;
        totalPoolLiquidity += amount;

        if (!_hasDeposited[msg.sender]) {
            _hasDeposited[msg.sender] = true;
            totalLenders++;
        }

        emit PoolDeposit(msg.sender, amount, totalPoolLiquidity);
    }

    /**
     * @notice Withdraw TRUST from the pool.
     * @dev    `amount` is the TRUST you receive. It includes your share of yield.
     *         The pool burns the shares that match `amount`.
     *         You can withdraw only what is free in the pool now.
     * @param  amount TRUST to receive.
     *
     * Emits {PoolWithdrawal}.
     */
    function withdrawFromPool(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "LendingPool: zero withdrawal");

        uint256 value = _poolValue();
        require(totalShares > 0 && value > 0, "LendingPool: pool is empty");

        // Round up so the pool never pays more than the shares are worth.
        uint256 sharesToBurn = (amount * totalShares + value - 1) / value;
        uint256 held = lenderShares[msg.sender];
        require(held >= sharesToBurn, "LendingPool: exceeds balance");
        require(totalPoolLiquidity >= amount, "LendingPool: insufficient free liquidity");

        // Part of the cost basis that leaves with these shares.
        uint256 principalPart = (lenderDeposits[msg.sender] * sharesToBurn) / held;

        lenderShares[msg.sender] = held - sharesToBurn;
        totalShares -= sharesToBurn;
        lenderDeposits[msg.sender] -= principalPart;
        totalPoolLiquidity -= amount;

        uint256 yieldEarned = amount > principalPart ? amount - principalPart : 0;

        trustToken.safeTransfer(msg.sender, amount);

        emit PoolWithdrawal(msg.sender, amount, yieldEarned);
    }

    /**
     * @notice Add TRUST to the pool for all lenders, without new shares.
     * @dev    Use it to pay back a loss, for example with slashed vouch stakes.
     *         Caller must first `approve` this contract for `amount`.
     * @param  amount TRUST to add.
     *
     * Emits {RecoveryAdded}.
     */
    function addRecovery(uint256 amount) external nonReentrant {
        require(amount > 0, "LendingPool: zero amount");
        require(totalShares > 0, "LendingPool: no lenders");
        trustToken.safeTransferFrom(msg.sender, address(this), amount);
        totalPoolLiquidity += amount;
        emit RecoveryAdded(msg.sender, amount);
    }

    /* ══════════════════════════════════════════
       BORROWER FUNCTIONS
    ═══════════════════════════════════════════ */

    /**
     * @notice Request a loan. Funds are immediately disbursed if all checks pass.
     * @dev    - A new wallet gets the starting score and an NFT on its first request.
     *         - The borrower must NOT have an Active loan or an unpaid defaulted loan.
     *         - The score must be at least MIN_BORROW_SCORE.
     *         - The amount must be within the limit of the score.
     *         - VouchBacked needs MIN_VOUCH_STAKE_FOR_LOAN of active vouch stake.
     *         - The Collateral path is not available.
     *         - The pool must have enough free liquidity.
     * @param  amount       Loan principal in TRUST (18 decimals).
     * @param  durationDays Loan term in days.
     * @param  path         0 = VouchBacked, 1 = Collateral (unavailable), 2 = TrustOnly.
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
        require(path != uint8(LoanPath.Collateral), "LendingPool: collateral path unavailable");

        _register(msg.sender);

        Loan storage existing = _loans[msg.sender];
        if (existing.amount > 0) {
            require(existing.status != LoanStatus.Active, "LendingPool: active loan exists");
            require(existing.status != LoanStatus.Defaulted, "LendingPool: unpaid defaulted loan");
        }

        // Trust-score-gated limit
        uint256 limit = getBorrowLimit(msg.sender);
        require(limit > 0, "LendingPool: trust score too low");
        require(amount <= limit, "LendingPool: exceeds trust limit");

        if (path == uint8(LoanPath.VouchBacked)) {
            require(
                IVouchSystem(vouchSystem).getTotalActiveStake(msg.sender) >= MIN_VOUCH_STAKE_FOR_LOAN,
                "LendingPool: not enough vouch stake"
            );
        }

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
        totalLoaned += amount;
        totalActiveLoans++;
        _activeInterestSum += rate;

        // Disburse
        trustToken.safeTransfer(msg.sender, amount);

        emit LoanDisbursed(msg.sender, amount, dueDate, loanPath);
    }

    /**
     * @notice Repay part or all of a loan.
     * @dev    On full repayment of an Active loan the loan is marked Repaid, the
     *         vouch stakes return and the score changes (see _increaseTrustScore).
     *         The borrower can also repay a Defaulted loan. This adds value back to
     *         the pool, clears the debt and allows new loans. It gives no score bonus.
     * @param  amount TRUST tokens to repay (caller must have approved this contract).
     *
     * Emits {RepaymentMade}.
     */
    function makeRepayment(uint256 amount) external nonReentrant whenNotPaused {
        Loan storage loan = _loans[msg.sender];
        require(loan.amount > 0, "LendingPool: no loan");
        require(
            loan.status == LoanStatus.Active || loan.status == LoanStatus.Defaulted,
            "LendingPool: no open loan"
        );
        require(amount > 0, "LendingPool: zero repayment");

        // Total owed = principal + interest
        uint256 totalOwed = _totalOwed(loan);
        uint256 remaining = totalOwed - loan.repaidAmount;
        require(amount <= remaining, "LendingPool: overpayment");

        // Pull tokens
        trustToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 repaidBefore = loan.repaidAmount;
        loan.repaidAmount += amount;
        if (loan.installmentsPaid < type(uint8).max) loan.installmentsPaid++;

        // Every repaid token is free liquidity again (principal and interest).
        totalPoolLiquidity += amount;

        if (loan.status == LoanStatus.Active) {
            // Part of this payment repays principal. The sum over all payments equals loan.amount.
            uint256 principalPortion =
                (loan.repaidAmount * loan.amount) / totalOwed -
                (repaidBefore * loan.amount) / totalOwed;
            totalLoaned -= principalPortion;

            if (loan.repaidAmount >= totalOwed) {
                loan.status = LoanStatus.Repaid;
                totalActiveLoans--;
                _activeInterestSum -= loan.interestRate;
                loansRepaid[msg.sender]++;
                _increaseTrustScore(msg.sender);
                _settleVouches(msg.sender, false);
            }
        } else if (loan.repaidAmount >= totalOwed) {
            // Defaulted loan paid in full. Principal was written off at default, so
            // the whole payment was recovery. The borrower can borrow again.
            loan.status = LoanStatus.Repaid;
        }

        remaining = totalOwed - loan.repaidAmount;

        emit RepaymentMade(msg.sender, amount, remaining, trustScores[msg.sender]);
    }

    /* ══════════════════════════════════════════
       ADMIN FUNCTIONS
    ═══════════════════════════════════════════ */

    /**
     * @notice Owner updates a borrower's trust score.
     * @dev    The NFT is updated too. A wallet that has no NFT yet gets one.
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

        _register(borrower);

        uint8 oldScore = trustScores[borrower];
        trustScores[borrower] = newScore;

        try ReputationNFT(reputationNFT).syncScore(borrower, newScore) {} catch {
            emit ReputationSyncFailed(borrower);
        }

        emit TrustScoreUpdated(borrower, oldScore, newScore);
    }

    /**
     * @notice Owner marks an overdue loan as defaulted.
     * @dev    The due date must have passed. The unpaid principal is removed from the
     *         pool value, so all lenders share the loss. The score drops by 15 and the
     *         vouch stakes of the borrower are slashed to the treasury.
     * @param  borrower Address of the defaulting borrower.
     *
     * Emits {LoanDefaulted}, {LossRealized}.
     */
    function markDefault(address borrower) external onlyOwner {
        Loan storage loan = _loans[borrower];
        require(loan.amount > 0 && loan.status == LoanStatus.Active, "LendingPool: not active");
        require(block.timestamp > loan.dueDate, "LendingPool: loan not overdue");

        uint256 totalOwed = _totalOwed(loan);

        loan.status = LoanStatus.Defaulted;
        totalActiveLoans--;
        _activeInterestSum -= loan.interestRate;

        // Write off the principal that is still unpaid.
        uint256 principalRepaid = (loan.repaidAmount * loan.amount) / totalOwed;
        uint256 principalLost = loan.amount - principalRepaid;
        totalLoaned -= principalLost;

        // Decrease trust score (floor at 0)
        uint8 oldScore = trustScores[borrower];
        uint8 penalty  = oldScore >= SCORE_DEFAULT_PENALTY ? oldScore - SCORE_DEFAULT_PENALTY : 0;
        trustScores[borrower] = penalty;

        try ReputationNFT(reputationNFT).recordDefault(borrower, penalty, loan.amount) {} catch {
            emit ReputationSyncFailed(borrower);
        }

        _settleVouches(borrower, true);

        emit LoanDefaulted(borrower, loan.amount, totalOwed - loan.repaidAmount);
        emit LossRealized(borrower, principalLost);
        emit TrustScoreUpdated(borrower, oldScore, penalty);
    }

    /**
     * @notice Owner mints the reputation NFT for a wallet and sets its starting score.
     * @dev    Does nothing if the wallet already has both.
     */
    function mintReputationNFT(address to) external onlyOwner {
        _register(to);
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

    /// @dev Free liquidity plus the principal that is out on loan.
    function _poolValue() internal view returns (uint256) {
        return totalPoolLiquidity + totalLoaned;
    }

    /**
     * @dev Gives a wallet its starting score and an NFT, one time.
     */
    function _register(address wallet) internal {
        if (!registered[wallet]) {
            registered[wallet] = true;
            if (trustScores[wallet] == 0) {
                trustScores[wallet] = INITIAL_SCORE;
            }
            emit BorrowerRegistered(wallet, trustScores[wallet]);
        }

        try ReputationNFT(reputationNFT).hasNFT(wallet) returns (bool has) {
            if (!has) {
                try ReputationNFT(reputationNFT).mintReputationNFT(wallet) {} catch {
                    emit ReputationSyncFailed(wallet);
                }
            }
        } catch {
            emit ReputationSyncFailed(wallet);
        }
    }

    /// @dev Settles the vouch stakes of a borrower. A failure must not block the loan end.
    function _settleVouches(address borrower, bool slash) internal {
        try IVouchSystem(vouchSystem).settleBorrower(borrower, slash) {} catch {
            emit VouchSettleFailed(borrower, slash);
        }
    }

    /**
     * @dev Adjusts the borrower's trust score after full repayment.
     *      - Repaid inside MIN_BONUS_AGE of the start:  +0 (stops quick borrow-and-repay farming)
     *      - Early repayment (before 75% of term):      +12
     *      - On-time (before dueDate):                  +8
     *      - Late (after dueDate):                      +3
     *      Capped at MAX_SCORE (100).
     */
    function _increaseTrustScore(address borrower) internal {
        Loan storage loan = _loans[borrower];
        uint8 oldScore = trustScores[borrower];

        uint8 bump;
        if (block.timestamp < loan.startTime + MIN_BONUS_AGE) {
            bump = 0;
        } else if (block.timestamp <= loan.startTime + ((loan.dueDate - loan.startTime) * 75) / 100) {
            bump = SCORE_EARLY;
        } else if (block.timestamp <= loan.dueDate) {
            bump = SCORE_ONTIME;
        } else {
            bump = SCORE_LATE;
        }

        uint8 newScore = oldScore + bump > MAX_SCORE ? MAX_SCORE : oldScore + bump;
        trustScores[borrower] = newScore;

        // Update the Reputation NFT (soulbound identity)
        try ReputationNFT(reputationNFT).updateReputation(
            borrower, newScore, loan.amount, block.timestamp <= loan.dueDate
        ) {} catch {
            emit ReputationSyncFailed(borrower);
        }

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
     * @notice True if the borrower has an Active loan.
     */
    function isLoanActive(address borrower) external view returns (bool) {
        Loan storage loan = _loans[borrower];
        return loan.amount > 0 && loan.status == LoanStatus.Active;
    }

    /**
     * @notice Returns a borrower's on-chain trust score.
     * @param  borrower Address to query.
     * @return score    0–100 trust score (the starting score for a wallet that is not registered yet).
     */
    function getTrustScore(address borrower) external view returns (uint8) {
        return registered[borrower] ? trustScores[borrower] : INITIAL_SCORE;
    }

    /**
     * @notice Returns the TRUST token balance held by this contract.
     * @return balance Includes pool liquidity and any tokens sent in by mistake.
     */
    function getPoolBalance() external view returns (uint256) {
        return trustToken.balanceOf(address(this));
    }

    /**
     * @notice Returns the current value of a lender's shares (principal plus yield).
     * @param  lender Address to query.
     * @return value  Amount of TRUST the shares are worth now.
     */
    function getLenderBalance(address lender) public view returns (uint256) {
        if (totalShares == 0) return 0;
        return (lenderShares[lender] * _poolValue()) / totalShares;
    }

    /**
     * @notice Returns a lender's principal, current value and shares.
     */
    function getLenderPosition(address lender)
        external
        view
        returns (uint256 principal, uint256 value, uint256 shares)
    {
        principal = lenderDeposits[lender];
        value     = getLenderBalance(lender);
        shares    = lenderShares[lender];
    }

    /**
     * @notice Returns the total value of the pool (free liquidity plus principal on loan).
     */
    function getPoolValue() external view returns (uint256) {
        return _poolValue();
    }

    /**
     * @notice Returns the maximum loan amount a borrower is eligible for,
     *         based on their trust score. Returns 0 below MIN_BORROW_SCORE.
     * @param  borrower Address to query.
     * @return limit    Max borrow amount in TRUST (18 decimals).
     */
    function getBorrowLimit(address borrower) public view returns (uint256) {
        uint8 score = registered[borrower] ? trustScores[borrower] : INITIAL_SCORE;
        if (score >= 80) return LIMIT_GOLD;
        if (score >= 60) return LIMIT_SILVER;
        if (score >= 40) return LIMIT_BRONZE;
        if (score >= MIN_BORROW_SCORE) return LIMIT_ENTRY;
        return 0;
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
     * @notice Returns total amount owed on a borrower's open loan
     *         (principal + interest). A defaulted loan counts as open.
     * @param  borrower Address to query.
     * @return owed Total owed, or 0 if no open loan.
     */
    function getTotalOwed(address borrower) external view returns (uint256) {
        Loan storage loan = _loans[borrower];
        if (!_isOpen(loan)) return 0;
        return _totalOwed(loan);
    }

    /**
     * @notice Returns remaining balance on a borrower's open loan.
     * @param  borrower Address to query.
     * @return remaining Amount still to be repaid.
     */
    function getRemainingDebt(address borrower) external view returns (uint256) {
        Loan storage loan = _loans[borrower];
        if (!_isOpen(loan)) return 0;
        uint256 owed = _totalOwed(loan);
        return owed > loan.repaidAmount ? owed - loan.repaidAmount : 0;
    }

    function _isOpen(Loan storage loan) internal view returns (bool) {
        return loan.amount > 0 &&
            (loan.status == LoanStatus.Active || loan.status == LoanStatus.Defaulted);
    }
}
