import json
import re
import shutil
import warnings
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

warnings.simplefilter("ignore")

REPO_ROOT = Path(__file__).resolve().parents[2]
GOOD = dict(repayment_history=0.95, repayment_speed=0.9, voucher_quality=70, loan_to_repayment_ratio=1.04,
            vouch_network_balance=1.0, transaction_frequency=10)
NEW = dict(repayment_history=0, repayment_speed=0, voucher_quality=0, loan_to_repayment_ratio=0,
           vouch_network_balance=1.0, transaction_frequency=0)
RISKY = dict(repayment_history=0.2, repayment_speed=0.1, voucher_quality=25, loan_to_repayment_ratio=0.55,
             vouch_network_balance=0.3, transaction_frequency=3)


@pytest.fixture(params=["retrained", "original"])
def client(request, monkeypatch):
    from app import model_store
    if not (model_store.MODELS_DIR / request.param / "metadata.json").exists():
        pytest.skip(f"model set '{request.param}' is not installed (the original set is not shipped)")
    monkeypatch.setenv("ML_MODEL_SET", request.param)
    model_store.load_bundle.cache_clear()
    from app.main import app
    return TestClient(app)


# ── trust score ──────────────────────────────────────────────────────────────

def test_good_borrower_scores_higher_than_new_and_risky(client):
    score = lambda body: client.post("/api/v1/trust-score", json=body).json()["trust_score"]
    assert score(GOOD) > 70
    assert score(GOOD) > score(NEW)
    assert score(GOOD) > score(RISKY)


def test_score_is_0_to_100_and_limit_matches_contract_bands(client):
    for body in (GOOD, NEW, RISKY):
        r = client.post("/api/v1/trust-score", json=body).json()
        assert 0 <= r["trust_score"] <= 100
        s = r["trust_score"]
        expected = 500 if s >= 80 else 200 if s >= 60 else 50 if s >= 40 else 10 if s >= 20 else 0
        assert r["suggested_limit_usd"] == expected
        assert r["advisory"] is True


def test_every_feature_has_an_explanation(client):
    r = client.post("/api/v1/trust-score", json=GOOD).json()
    assert {f["feature"] for f in r["factors"]} == set(GOOD)
    assert abs(r["factors"][0]["impact_points"]) >= abs(r["factors"][-1]["impact_points"])


def test_out_of_range_input_is_rejected(client):
    assert client.post("/api/v1/trust-score", json={**GOOD, "voucher_quality": 500}).status_code == 422
    assert client.post("/api/v1/trust-score", json={**GOOD, "repayment_history": -1}).status_code == 422
    missing = dict(GOOD); missing.pop("repayment_speed")
    assert client.post("/api/v1/trust-score", json=missing).status_code == 422


# ── fraud ────────────────────────────────────────────────────────────────────

def test_hard_rules_flag_velocity_and_young_vouchers(client):
    r = client.post("/api/v1/fraud-check", json=dict(
        vouch_requests_24h=11, avg_voucher_account_age_days=100, network_clustering_score=0.1)).json()
    assert r["is_fraudulent"] and any("Velocity" in x for x in r["reasons"])
    r = client.post("/api/v1/fraud-check", json=dict(
        vouch_requests_24h=1, avg_voucher_account_age_days=3, network_clustering_score=0.1)).json()
    assert r["is_fraudulent"] and any("too new" in x for x in r["reasons"])


def test_a_closed_ring_is_flagged_and_a_normal_wallet_is_not(client):
    ring = client.post("/api/v1/fraud-check", json=dict(
        vouch_requests_24h=40, avg_voucher_account_age_days=2, network_clustering_score=0.9)).json()
    normal = client.post("/api/v1/fraud-check", json=dict(
        vouch_requests_24h=2, avg_voucher_account_age_days=140, network_clustering_score=0.12)).json()
    assert ring["is_fraudulent"] is True
    assert normal["is_fraudulent"] is False and normal["reasons"] == []


# ── schedule and rate ────────────────────────────────────────────────────────

def test_schedule_archetypes(client):
    get = lambda tx, gap: client.post("/api/v1/repayment-schedule", json=dict(
        tx_per_month=tx, avg_days_between_tx=gap)).json()["data"]
    assert get(30, 1)["archetype"] == "Daily Earner"
    assert get(7, 6)["archetype"] == "Weekly Earner"
    seasonal = get(1, 60)
    assert seasonal["archetype"] == "Seasonal Earner" and seasonal["recommended_installments"] == 1


def test_rate_formula_follows_the_documented_rule(client):
    r = client.post("/api/v1/interest-rate", json=dict(
        trust_score=30, loan_duration_days=30, vouch_coverage_pct=0)).json()["data"]
    assert r["risk_premium_pct"] == pytest.approx(10.5)
    assert r["total_interest_rate_pct"] == pytest.approx(3.0 + 10.5 + 30 / 365 * 5, abs=0.01)
    floor = client.post("/api/v1/interest-rate", json=dict(
        trust_score=100, loan_duration_days=1, vouch_coverage_pct=100)).json()["data"]
    assert floor["total_interest_rate_pct"] == 1.0


# ── transparency ─────────────────────────────────────────────────────────────

def test_model_info_states_where_the_models_came_from(client):
    info = client.get("/api/v1/model-info").json()
    assert info["real_world_validation"] == "none"
    assert info["data_source"] in ("synthetic", "unknown")
    assert set(info["models"]) == {"trust", "fraud", "schedule"}
    assert all(len(m["sha256"]) == 64 for m in info["models"].values())


# ── safety ───────────────────────────────────────────────────────────────────

def test_a_tampered_model_file_is_refused(tmp_path, monkeypatch):
    from app import model_store
    copy = tmp_path / "models"
    shutil.copytree(model_store.MODELS_DIR / "retrained", copy / "retrained")
    victim = copy / "retrained" / "fraud_model.joblib"
    victim.write_bytes(victim.read_bytes() + b"tampered")
    monkeypatch.setattr(model_store, "MODELS_DIR", copy)
    model_store.load_bundle.cache_clear()
    with pytest.raises(model_store.ModelIntegrityError):
        model_store.load_bundle("retrained")
    model_store.load_bundle.cache_clear()


def test_unknown_model_set_is_rejected(monkeypatch):
    from app import model_store
    monkeypatch.setenv("ML_MODEL_SET", "evil")
    with pytest.raises(ValueError):
        model_store.default_set()


def test_cors_only_allows_the_configured_origins(client):
    ok = client.options("/api/v1/trust-score", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    bad = client.options("/api/v1/trust-score", headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-origin" not in bad.headers


def test_limit_bands_match_the_contract():
    source = (REPO_ROOT / "blockchain" / "contracts" / "LendingPool.sol").read_text(encoding="utf-8")
    limits = {k: int(v) for k, v in re.findall(r"LIMIT_(ENTRY|BRONZE|SILVER|GOLD)\s*=\s*(\d+)\s*\*\s*1e18", source)}
    min_score = int(re.search(r"MIN_BORROW_SCORE\s*=\s*(\d+)", source).group(1))
    from app.features import limit_for_score
    assert limits == {"ENTRY": 10, "BRONZE": 50, "SILVER": 200, "GOLD": 500}
    assert min_score == 20
    assert [limit_for_score(s) for s in (19, 20, 39, 40, 59, 60, 79, 80, 100)] == [0, 10, 10, 50, 50, 200, 200, 500, 500]


# ── wallet assessment (chain reader replaced by a fixed profile) ─────────────

class _FakeReader:
    def __init__(self, profile):
        self._profile = profile

    def profile(self, address):
        return self._profile


def _profile(finished=2, vouches=0, tx=6):
    return {
        "address": "0x" + "ab" * 20, "chain_time": 0, "on_chain_score": 42,
        "history": {"finished_loans": finished, "repaid_loans": finished, "defaulted_loans": 0,
                    "transactions": tx, "vouches_received": vouches, "vouches_given": 0},
        "trust_features": dict(GOOD),
        "fraud_features": dict(vouch_requests_24h=1, avg_voucher_account_age_days=90, network_clustering_score=0.1),
        "schedule_features": dict(tx_per_month=6, avg_days_between_tx=7),
    }


def test_wallet_assessment_with_history(client, monkeypatch):
    from app import main
    monkeypatch.setattr(main, "get_reader", lambda: _FakeReader(_profile(finished=2, vouches=2)))
    r = client.get("/api/v1/wallet/0x" + "ab" * 20 + "/assessment").json()
    assert r["advisory"] is True and r["on_chain_trust_score"] == 42
    assert r["trust"]["status"] == "ok" and r["trust"]["trust_score"] > 50
    assert r["fraud"]["status"] == "ok"
    assert r["schedule"]["status"] == "ok"


def test_wallet_assessment_says_so_when_there_is_no_history(client, monkeypatch):
    from app import main
    monkeypatch.setattr(main, "get_reader", lambda: _FakeReader(_profile(finished=0, vouches=0, tx=1)))
    r = client.get("/api/v1/wallet/0x" + "ab" * 20 + "/assessment").json()
    assert r["trust"]["status"] == "insufficient_history" and "trust_score" not in r["trust"]
    assert r["fraud"]["status"] == "not_applicable"
    assert r["schedule"]["status"] == "insufficient_history"


def test_wallet_assessment_rejects_a_bad_address(client):
    assert client.get("/api/v1/wallet/not-an-address/assessment").status_code == 422


def test_wallet_assessment_reports_when_the_chain_is_unreachable(client, monkeypatch):
    from app import main
    from app.chain import ChainUnavailable

    def boom():
        raise ChainUnavailable("Cannot reach the RPC")
    monkeypatch.setattr(main, "get_reader", boom)
    r = client.get("/api/v1/wallet/0x" + "ab" * 20 + "/assessment")
    assert r.status_code == 503 and "RPC" in r.json()["detail"]
