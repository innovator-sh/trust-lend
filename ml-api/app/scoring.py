"""Trust score, fraud check, repayment schedule and rate suggestion."""

import pandas as pd

from app.features import (
    FRAUD_FEATURES, MAX_VOUCH_REQUESTS_24H, MIN_AVG_VOUCHER_AGE_DAYS, SCHEDULE_FEATURES,
    TRUST_FEATURES, TRUST_REFERENCE, limit_for_score,
)
from app.model_store import ModelBundle


# ── 1. Trust score (Random Forest) ──────────────────────────────────────────────

def _repay_probability(bundle: ModelBundle, features: dict) -> float:
    frame = pd.DataFrame([features])[TRUST_FEATURES]
    class_index = list(bundle.trust.classes_).index(1)
    return float(bundle.trust.predict_proba(frame)[0][class_index])


def score_trust(bundle: ModelBundle, features: dict) -> dict:
    """Score = 100 x the model's probability that the borrower repays (class 1)."""
    probability = _repay_probability(bundle, features)
    score = max(0, min(100, int(round(probability * 100))))

    # Explain the score: replace one feature at a time by a neutral value and see how far the
    # score moves. A positive impact means this feature's value pushes the score up.
    factors = []
    for name in TRUST_FEATURES:
        neutral = dict(features)
        neutral[name] = TRUST_REFERENCE[name]
        impact = round((probability - _repay_probability(bundle, neutral)) * 100, 1)
        factors.append({"feature": name, "value": features[name], "impact_points": impact})
    factors.sort(key=lambda f: -abs(f["impact_points"]))

    return {
        "trust_score": score,
        "repay_probability": round(probability, 4),
        "suggested_limit_usd": limit_for_score(score),
        "factors": factors,
    }


# ── 2. Fraud and sybil check (rules + Isolation Forest) ─────────────────────────

def check_fraud(bundle: ModelBundle, features: dict) -> dict:
    reasons = []

    # Hard rules first.
    if features["vouch_requests_24h"] > MAX_VOUCH_REQUESTS_24H:
        reasons.append(f"Velocity limit exceeded (more than {MAX_VOUCH_REQUESTS_24H} vouches in 24 hours)")
    if features["avg_voucher_account_age_days"] < MIN_AVG_VOUCHER_AGE_DAYS:
        reasons.append(f"Vouchers are too new (average under {MIN_AVG_VOUCHER_AGE_DAYS} days)")

    # Then the anomaly model. predict() returns -1 for an anomaly.
    frame = pd.DataFrame([features])[FRAUD_FEATURES]
    anomaly = int(bundle.fraud.predict(frame)[0]) == -1
    anomaly_score = float(bundle.fraud.decision_function(frame)[0])  # below 0 = anomalous
    if anomaly:
        reasons.append("Anomaly model flagged this vouch pattern")

    return {
        "is_fraudulent": bool(reasons),
        "reasons": reasons,
        "rule_flags": len([r for r in reasons if not r.startswith("Anomaly")]),
        "anomaly_flagged": anomaly,
        "anomaly_score": round(anomaly_score, 4),
    }


# ── 3. Repayment schedule (K-Means archetypes) ──────────────────────────────────

_TEMPLATES = {
    "Daily Earner": {
        "schedule_type": "Daily micro-installments", "grace_period_days": 1, "recommended_installments": 30,
    },
    "Weekly Earner": {
        "schedule_type": "Weekly installments", "grace_period_days": 3, "recommended_installments": 4,
    },
    "Seasonal Earner": {
        "schedule_type": "Lump sum with a grace period", "grace_period_days": 30, "recommended_installments": 1,
    },
}


def get_schedule(bundle: ModelBundle, features: dict) -> dict:
    frame = pd.DataFrame([features])[SCHEDULE_FEATURES]
    cluster = int(bundle.schedule.predict(frame)[0])
    archetype = bundle.cluster_to_archetype.get(cluster, "Unknown")
    template = _TEMPLATES.get(archetype, {
        "schedule_type": "Monthly installment", "grace_period_days": 0, "recommended_installments": 1,
    })
    return {"archetype": archetype, **template}


# ── 4. Rate suggestion (a formula, NOT a model) ─────────────────────────────────

def suggest_rate(trust_score: int, loan_duration_days: int, vouch_coverage_pct: float) -> dict:
    """Advisory rate in percent. The contract charges fixed rates (7.1% and 4.2%), not this."""
    base = 3.0
    risk_premium = max(0.0, (100 - trust_score) * 0.15)
    duration_premium = (loan_duration_days / 365.0) * 5.0
    coverage = max(0.0, min(1.0, vouch_coverage_pct / 100.0))
    vouch_discount = coverage * 6.0
    total = max(1.0, base + risk_premium + duration_premium - vouch_discount)
    return {
        "base_rate_pct": round(base, 2),
        "risk_premium_pct": round(risk_premium, 2),
        "duration_premium_pct": round(duration_premium, 2),
        "vouch_discount_pct": round(vouch_discount, 2),
        "total_interest_rate_pct": round(total, 2),
        "note": "Formula, not a trained model. Advisory only. The contract charges fixed rates.",
    }
