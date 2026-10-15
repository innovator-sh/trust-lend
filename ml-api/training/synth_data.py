"""Synthetic training data.

IMPORTANT: TrustLend has no real repayment history yet, so these models are trained on
SYNTHETIC data. Each generator states its assumptions. A model trained this way learns those
assumptions. It does not measure real default risk. Replace the generators with real data
before the scores are used for anything more than advice and demos.
"""

import numpy as np
import pandas as pd

from app.features import (
    FRAUD_FEATURES, SCHEDULE_FEATURES, TRUST_FEATURES, TRUST_RANGES, TRUST_WEIGHTS,
)

ARCHETYPES = ["Daily Earner", "Weekly Earner", "Seasonal Earner"]


def _sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def make_trust_data(n: int, seed: int):
    """Borrower features, a 0/1 'repays' label and the true repay probability.

    Assumptions
    - Every feature is drawn uniformly from its full range, so the model sees the whole space.
    - The chance of repaying is a logistic function of the weighted sum of the min-max
      normalised features (weights in app/features.py). The label is a coin flip with that chance.
    - The sum is centred so that an average borrower has a 50% chance.
    """
    rng = np.random.default_rng(seed)
    X = pd.DataFrame({
        name: rng.uniform(lo, hi, n) for name, (lo, hi) in TRUST_RANGES.items()
    })[TRUST_FEATURES]

    norm = pd.DataFrame({
        name: (X[name] - lo) / (hi - lo) for name, (lo, hi) in TRUST_RANGES.items()
    })
    weighted = sum(TRUST_WEIGHTS[c] * norm[c] for c in TRUST_FEATURES)
    p_true = _sigmoid(10.0 * (weighted.to_numpy() - 0.5))
    y = rng.binomial(1, p_true)
    return X, y, p_true


def make_fraud_data(n: int, seed: int) -> pd.DataFrame:
    """NORMAL wallets only. The anomaly model learns what normal looks like.

    Assumptions
    - Real users receive about 2 vouches in 24 hours (Poisson, mean 1.8).
    - Vouchers have been on the platform for months (gamma, mean about 135 days).
    - Real vouch networks are open. Clustering is low (beta, mean about 0.125).
    """
    rng = np.random.default_rng(seed)
    return pd.DataFrame({
        "vouch_requests_24h": np.clip(rng.poisson(1.8, n), 0, 14),
        "avg_voucher_account_age_days": np.clip(rng.gamma(3.0, 45.0, n), 1, 365),
        "network_clustering_score": np.clip(rng.beta(2.0, 14.0, n), 0, 1),
    })[FRAUD_FEATURES]


def make_fraud_attacks(n: int, seed: int) -> pd.DataFrame:
    """Synthetic sybil rings. Used ONLY to measure the detector, never to train it."""
    rng = np.random.default_rng(seed)
    return pd.DataFrame({
        "vouch_requests_24h": rng.integers(8, 60, n),
        "avg_voucher_account_age_days": rng.uniform(0, 12, n),
        "network_clustering_score": rng.uniform(0.55, 1.0, n),
    })[FRAUD_FEATURES]


def make_schedule_data(n: int, seed: int):
    """Earning patterns and their true archetype (0 daily, 1 weekly, 2 seasonal).

    Assumptions
    - Daily earners (gig work) move money about 30 times a month, about once a day.
    - Weekly earners move money about 7 times a month, every 4 to 6 days.
    - Seasonal earners (farming) move money about once a month, with gaps of 20 to 60 days.
    """
    rng = np.random.default_rng(seed)
    labels = rng.choice(3, size=n, p=[0.35, 0.40, 0.25])
    tx = np.where(labels == 0, rng.normal(28, 6, n),
         np.where(labels == 1, rng.normal(6, 1.8, n), rng.normal(1.0, 0.4, n)))
    gap = np.where(labels == 0, rng.normal(1.3, 0.4, n),
          np.where(labels == 1, rng.normal(7, 1.8, n), rng.normal(55, 12, n)))
    X = pd.DataFrame({
        "tx_per_month": np.clip(tx, 0.2, 60),
        "avg_days_between_tx": np.clip(gap, 0.3, 120),
    })[SCHEDULE_FEATURES]
    return X, labels
