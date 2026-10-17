"""TrustLend ML API (advisory).

The scores from this service are ADVICE. They are never written to the contract or the database.
The on-chain trust score comes only from the rules in LendingPool.sol.

Run from the ml-api folder:  uvicorn app.main:app --port 8000
"""

import os
import re
import time
from collections import defaultdict, deque

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import scoring
from app.chain import ChainUnavailable, get_reader
from app.features import TRUST_RANGES
from app.model_store import ModelIntegrityError, ModelSetMissing, get_bundle

DISCLAIMER = (
    "Advisory only. The models are trained on synthetic or unverified data and have not been "
    "validated on real borrowers. This score does not change your on-chain trust score or limits."
)

app = FastAPI(title="TrustLend ML API", version="2.0.0")

origins = [o.strip() for o in os.environ.get(
    "ML_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=False,
    allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
)

# ── a small per-IP rate limit (chain reads are expensive) ────────────────────────
_RATE_LIMIT, _WINDOW_S = int(os.environ.get("ML_RATE_LIMIT_PER_MIN", "60")), 60
_hits: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    ip = request.client.host if request.client else "unknown"
    now, hits = time.time(), _hits[ip]
    while hits and now - hits[0] > _WINDOW_S:
        hits.popleft()
    if len(hits) >= _RATE_LIMIT:
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "Too many requests"}, status_code=429)
    hits.append(now)
    return await call_next(request)


def _bundle():
    try:
        return get_bundle()
    except ModelSetMissing as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ModelIntegrityError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── request models. Ranges match the scales the models were trained on. ─────────

class TrustScoreRequest(BaseModel):
    repayment_history: float = Field(ge=TRUST_RANGES["repayment_history"][0], le=TRUST_RANGES["repayment_history"][1])
    repayment_speed: float = Field(ge=TRUST_RANGES["repayment_speed"][0], le=TRUST_RANGES["repayment_speed"][1])
    voucher_quality: float = Field(ge=TRUST_RANGES["voucher_quality"][0], le=TRUST_RANGES["voucher_quality"][1])
    loan_to_repayment_ratio: float = Field(ge=TRUST_RANGES["loan_to_repayment_ratio"][0], le=TRUST_RANGES["loan_to_repayment_ratio"][1])
    vouch_network_balance: float = Field(ge=TRUST_RANGES["vouch_network_balance"][0], le=TRUST_RANGES["vouch_network_balance"][1])
    transaction_frequency: float = Field(ge=TRUST_RANGES["transaction_frequency"][0], le=TRUST_RANGES["transaction_frequency"][1])


class FraudRequest(BaseModel):
    vouch_requests_24h: int = Field(ge=0, le=10_000)
    avg_voucher_account_age_days: float = Field(ge=0, le=36_500)
    network_clustering_score: float = Field(ge=0, le=1)


class ScheduleRequest(BaseModel):
    tx_per_month: float = Field(ge=0, le=10_000)
    avg_days_between_tx: float = Field(ge=0, le=3_650)


class RateRequest(BaseModel):
    trust_score: int = Field(ge=0, le=100)
    loan_duration_days: int = Field(ge=1, le=365)
    vouch_coverage_pct: float = Field(ge=0, le=100)


# ── endpoints ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "TrustLend ML API", "advisory": True}


@app.get("/health")
def health():
    bundle = _bundle()
    return {
        "status": "ok",
        "model_set": bundle.set_name,
        "endpoints": ["/api/v1/trust-score", "/api/v1/fraud-check", "/api/v1/repayment-schedule",
                      "/api/v1/interest-rate", "/api/v1/wallet/{address}/assessment", "/api/v1/model-info"],
    }


@app.get("/api/v1/model-info")
def model_info():
    """Where the models came from and how they were measured. Shown so nobody has to guess."""
    bundle = _bundle()
    meta = bundle.metadata
    return {
        "model_set": bundle.set_name,
        "provenance": meta["provenance"],
        "data_source": meta["data_source"],
        "real_world_validation": meta["real_world_validation"],
        "known_limits": meta.get("known_limits", []),
        "models": {k: {"file": v["file"], "sha256": v["sha256"], "features": v["features"],
                       "details": v.get("metrics") or v.get("model")} for k, v in meta["files"].items()},
        "disclaimer": DISCLAIMER,
    }


@app.post("/api/v1/trust-score")
def trust_score(req: TrustScoreRequest):
    return {"status": "success", "advisory": True, **scoring.score_trust(_bundle(), req.model_dump())}


@app.post("/api/v1/fraud-check")
def fraud_check(req: FraudRequest):
    return {"status": "success", "advisory": True, **scoring.check_fraud(_bundle(), req.model_dump())}


@app.post("/api/v1/repayment-schedule")
def repayment_schedule(req: ScheduleRequest):
    return {"status": "success", "advisory": True, "data": scoring.get_schedule(_bundle(), req.model_dump())}


@app.post("/api/v1/interest-rate")
def interest_rate(req: RateRequest):
    return {"status": "success", "advisory": True,
            "data": scoring.suggest_rate(req.trust_score, req.loan_duration_days, req.vouch_coverage_pct)}


@app.get("/api/v1/wallet/{address}/assessment")
def wallet_assessment(address: str):
    """Everything above, with the inputs built from the chain instead of the browser."""
    if not re.fullmatch(r"0x[0-9a-fA-F]{40}", address):
        raise HTTPException(status_code=422, detail="address must be a 0x-prefixed 40-hex-character address")
    bundle = _bundle()
    try:
        profile = get_reader().profile(address)
    except ChainUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # RPC or ABI errors must not leak a stack trace
        raise HTTPException(status_code=502, detail=f"Could not read the chain: {type(exc).__name__}") from exc

    history = profile["history"]

    if history["finished_loans"] == 0:
        trust = {"status": "insufficient_history",
                 "message": "A trust estimate needs at least one finished loan (repaid or defaulted)."}
    else:
        trust = {"status": "ok", **scoring.score_trust(bundle, profile["trust_features"]),
                 "features": profile["trust_features"]}

    if history["vouches_received"] == 0:
        fraud = {"status": "not_applicable", "message": "No vouches on this wallet, so there is no vouch pattern to check."}
    else:
        fraud = {"status": "ok", **scoring.check_fraud(bundle, profile["fraud_features"]),
                 "features": profile["fraud_features"]}

    if profile["schedule_features"] is None or history["transactions"] < 4:
        schedule = {"status": "insufficient_history",
                    "message": "A repayment pattern needs at least 4 transactions."}
    else:
        schedule = {"status": "ok", **scoring.get_schedule(bundle, profile["schedule_features"]),
                    "features": profile["schedule_features"]}

    return {
        "wallet": profile["address"],
        "model_set": bundle.set_name,
        "advisory": True,
        "disclaimer": DISCLAIMER,
        "on_chain_trust_score": profile["on_chain_score"],
        "history": history,
        "trust": trust,
        "fraud": fraud,
        "schedule": schedule,
    }
