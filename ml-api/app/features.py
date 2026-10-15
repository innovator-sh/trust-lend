"""Feature names, value ranges and fixed rules shared by training and serving.

The ranges follow the scales the ORIGINAL models were trained on. The original trust model
splits voucher_quality between 20 and 100, vouch_network_balance between 0 and 2, and so on.
Feeding it values on another scale (for example voucher_quality 0..1) gives wrong scores.
"""

# name -> (min, max)
TRUST_RANGES = {
    "repayment_history": (0.0, 1.0),         # share of finished loans that were repaid
    "repayment_speed": (0.0, 1.0),           # how early loans were repaid (1 = at once, 0 = at the due date or never)
    "voucher_quality": (0.0, 100.0),         # average on-chain trust score of the vouchers
    "loan_to_repayment_ratio": (0.0, 1.5),   # money repaid divided by money borrowed (finished loans)
    "vouch_network_balance": (0.0, 2.0),     # vouches given divided by vouches received (1 = balanced)
    "transaction_frequency": (0.0, 100.0),   # loan and repayment transactions per month
}
TRUST_FEATURES = list(TRUST_RANGES)

# A neutral value for each feature, used to explain a score ("what if this feature were average").
TRUST_REFERENCE = {
    "repayment_history": 0.5,
    "repayment_speed": 0.5,
    "voucher_quality": 60.0,
    "loan_to_repayment_ratio": 1.0,
    "vouch_network_balance": 1.0,
    "transaction_frequency": 20.0,
}

# Weights from the design notes. They are the ASSUMPTIONS used to label the synthetic training data
# of the retrained model (training/synth_data.py).
TRUST_WEIGHTS = {
    "repayment_history": 0.30,
    "repayment_speed": 0.20,
    "voucher_quality": 0.15,
    "loan_to_repayment_ratio": 0.15,
    "vouch_network_balance": 0.10,
    "transaction_frequency": 0.10,
}

FRAUD_FEATURES = [
    "vouch_requests_24h",            # vouches placed on this wallet in the last 24 hours
    "avg_voucher_account_age_days",   # average age of the vouchers on the platform, in days
    "network_clustering_score",      # 0..1, how closed the vouch network is (1 = a closed ring)
]

SCHEDULE_FEATURES = [
    "tx_per_month",          # transactions per month
    "avg_days_between_tx",   # average days between transactions
]

# Hard fraud rules. They run before the anomaly model.
MAX_VOUCH_REQUESTS_24H = 10
MIN_AVG_VOUCHER_AGE_DAYS = 7


def limit_for_score(score: int) -> int:
    """Suggested loan limit in USD for a 0-100 score.

    The bands match LendingPool.getBorrowLimit in blockchain/contracts/LendingPool.sol:
    below 20 cannot borrow, then $10 / $50 / $200 / $500 at 20 / 40 / 60 / 80.
    """
    if score >= 80:
        return 500
    if score >= 60:
        return 200
    if score >= 40:
        return 50
    if score >= 20:
        return 10
    return 0
