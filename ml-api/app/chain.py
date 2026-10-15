"""Build model inputs from the chain, so the browser cannot choose them.

Everything here is derived from LendingPool, VouchSystem and ReputationNFT events and views.
Where the chain does not hold the exact quantity, the code uses a documented proxy.

Feature derivation (see ml-api/README.md for the table):
- repayment_history        repaid loans / finished loans (repaid + defaulted)
- repayment_speed          mean of (due date - repayment time) / (due date - loan start), clipped 0..1
- voucher_quality          mean current on-chain trust score of the wallet's vouchers (0..100)
- loan_to_repayment_ratio  money repaid / money borrowed, over finished loans, capped at 1.5
- vouch_network_balance    (vouches given + 1) / (vouches received + 1), capped at 2
- transaction_frequency    loan and repayment transactions per month (capped at 100)
- vouch_requests_24h       vouches placed on the wallet in the last 24 hours
- avg_voucher_account_age  PROXY: days since each voucher's FIRST activity on TrustLend (a vouch, a
                           deposit, a registration or a loan). A plain RPC cannot give the real
                           account age. A wallet created and used for the first time today looks new.
- network_clustering_score share of possible vouch links among the wallet's vouchers that exist
                           (needs at least 3 vouchers, otherwise 0)
"""

import json
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path

from web3 import Web3

REPO_ROOT = Path(__file__).resolve().parents[2]
ABI_DIR = REPO_ROOT / "src" / "contracts"


class ChainUnavailable(RuntimeError):
    """The RPC or the contract addresses are not configured or not reachable."""


@dataclass(frozen=True)
class ChainConfig:
    rpc_url: str
    pool: str
    nft: str
    vouch: str
    from_block: int
    chunk: int


def _addresses_from_frontend() -> dict:
    """Read src/contracts/addresses.js (written by blockchain/scripts/deploy.js)."""
    path = ABI_DIR / "addresses.js"
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8")
    found = {}
    for key, name in (("LENDING_POOL", "pool"), ("REPUTATION_NFT", "nft"), ("VOUCH_SYSTEM", "vouch")):
        match = re.search(rf'{key}:\s*"(0x[0-9a-fA-F]{{40}})"', text)
        if match:
            found[name] = match.group(1)
    return found


def load_config() -> ChainConfig:
    file_addrs = _addresses_from_frontend()
    pool = os.environ.get("ML_POOL_ADDRESS") or file_addrs.get("pool")
    nft = os.environ.get("ML_NFT_ADDRESS") or file_addrs.get("nft")
    vouch = os.environ.get("ML_VOUCH_ADDRESS") or file_addrs.get("vouch")
    if not (pool and nft and vouch):
        raise ChainUnavailable("Contract addresses are not configured (ML_POOL_ADDRESS, ML_NFT_ADDRESS, ML_VOUCH_ADDRESS).")
    return ChainConfig(
        rpc_url=os.environ.get("ML_RPC_URL", "http://127.0.0.1:8545"),
        pool=Web3.to_checksum_address(pool),
        nft=Web3.to_checksum_address(nft),
        vouch=Web3.to_checksum_address(vouch),
        from_block=int(os.environ.get("ML_FROM_BLOCK", "0")),
        chunk=int(os.environ.get("ML_LOG_CHUNK", "5000")),
    )


def _abi(name: str) -> list:
    return json.loads((ABI_DIR / f"{name}.json").read_text(encoding="utf-8"))["abi"]


class ChainReader:
    def __init__(self, config: ChainConfig):
        self.config = config
        self.w3 = Web3(Web3.HTTPProvider(config.rpc_url, request_kwargs={"timeout": 15}))
        try:
            connected = self.w3.is_connected()
        except Exception as exc:  # network errors
            raise ChainUnavailable(f"Cannot reach the RPC at {config.rpc_url}: {exc}") from exc
        if not connected:
            raise ChainUnavailable(f"Cannot reach the RPC at {config.rpc_url}")
        self.pool = self.w3.eth.contract(address=config.pool, abi=_abi("LendingPool"))
        self.nft = self.w3.eth.contract(address=config.nft, abi=_abi("ReputationNFT"))
        self.vouch = self.w3.eth.contract(address=config.vouch, abi=_abi("VouchSystem"))
        self._block_time: dict[int, int] = {}

    # ── helpers ───────────────────────────────────────────────

    def _logs(self, event, filters=None):
        latest = self.w3.eth.block_number
        out, start = [], self.config.from_block
        while start <= latest:
            end = min(start + self.config.chunk - 1, latest)
            out.extend(event.get_logs(from_block=start, to_block=end, argument_filters=filters or {}))
            start = end + 1
        return out

    def _ts(self, block_number: int) -> int:
        if block_number not in self._block_time:
            self._block_time[block_number] = int(self.w3.eth.get_block(block_number)["timestamp"])
        return self._block_time[block_number]

    def _first_activity(self, wallet: str, all_stakes: list) -> int:
        """Timestamp of the wallet's first event on TrustLend. Used as an account-age proxy."""
        stamps = [self._ts(e["blockNumber"]) for e in all_stakes
                  if e["args"]["voucher"] == wallet or e["args"]["borrower"] == wallet]
        for event, key in ((self.pool.events.PoolDeposit, "lender"),
                           (self.pool.events.BorrowerRegistered, "wallet"),
                           (self.pool.events.LoanDisbursed, "borrower")):
            stamps += [self._ts(e["blockNumber"]) for e in self._logs(event, {key: wallet})]
        if self.nft.functions.hasNFT(wallet).call():
            stamps.append(int(self.nft.functions.getReputation(wallet).call()[5]))  # memberSince
        return min(stamps) if stamps else 0

    # ── the profile ───────────────────────────────────────────

    def profile(self, address: str) -> dict:
        addr = Web3.to_checksum_address(address)
        now = int(self.w3.eth.get_block("latest")["timestamp"])  # chain time (also right on test chains)

        disbursed = self._logs(self.pool.events.LoanDisbursed, {"borrower": addr})
        repayments = self._logs(self.pool.events.RepaymentMade, {"borrower": addr})
        defaults = self._logs(self.pool.events.LoanDefaulted, {"borrower": addr})

        # Replay the loan history in order. One loan is open at a time.
        timeline = (
            [("loan", e) for e in disbursed] + [("pay", e) for e in repayments] + [("default", e) for e in defaults]
        )
        timeline.sort(key=lambda t: (t[1]["blockNumber"], t[1]["logIndex"]))

        open_loan, closed = None, []
        for kind, ev in timeline:
            args, ts = ev["args"], self._ts(ev["blockNumber"])
            if kind == "loan":
                open_loan = {"principal": args["amount"], "start": ts, "due": args["dueDate"], "repaid": 0}
            elif kind == "pay" and open_loan is not None:
                open_loan["repaid"] += args["amount"]
                if args["remaining"] == 0:
                    span = max(1, open_loan["due"] - open_loan["start"])
                    speed = min(1.0, max(0.0, (open_loan["due"] - ts) / span))
                    closed.append({**open_loan, "outcome": "repaid", "speed": speed})
                    open_loan = None
            elif kind == "default" and open_loan is not None:
                closed.append({**open_loan, "outcome": "defaulted", "speed": 0.0})
                open_loan = None

        repaid = [c for c in closed if c["outcome"] == "repaid"]
        defaulted = [c for c in closed if c["outcome"] == "defaulted"]
        finished = len(closed)

        total_principal = sum(c["principal"] for c in closed)
        total_repaid = sum(c["repaid"] for c in closed)

        tx_times = sorted(self._ts(e["blockNumber"]) for e in list(disbursed) + list(repayments))
        months = max(1.0, (now - tx_times[0]) / (30 * 86400)) if tx_times else 1.0
        tx_per_month = min(100.0, len(tx_times) / months)
        gaps = [(b - a) / 86400 for a, b in zip(tx_times, tx_times[1:])]
        avg_gap_days = sum(gaps) / len(gaps) if gaps else None

        # Vouches
        all_stakes = self._logs(self.vouch.events.VouchStaked)
        received = [e for e in all_stakes if e["args"]["borrower"] == addr]
        given = [e for e in all_stakes if e["args"]["voucher"] == addr]
        vouchers = sorted({e["args"]["voucher"] for e in received})

        if vouchers:
            scores = [self.pool.functions.getTrustScore(v).call() for v in vouchers]
            voucher_quality = sum(scores) / len(scores)
            ages = []
            for v in vouchers:
                first = self._first_activity(v, all_stakes)
                ages.append(max(0.0, (now - first) / 86400) if first else 0.0)
            avg_voucher_age = sum(ages) / len(ages)
        else:
            voucher_quality, avg_voucher_age = 0.0, 0.0

        voucher_set = set(vouchers)
        links = {(e["args"]["voucher"], e["args"]["borrower"]) for e in all_stakes
                 if e["args"]["voucher"] in voucher_set and e["args"]["borrower"] in voucher_set
                 and e["args"]["voucher"] != e["args"]["borrower"]}
        n = len(voucher_set)
        # With fewer than 3 vouchers the density means nothing (2 linked wallets always score 0.5).
        clustering = len(links) / (n * (n - 1)) if n >= 3 else 0.0

        recent = [e for e in received if now - self._ts(e["blockNumber"]) <= 86400]

        return {
            "address": addr,
            "chain_time": now,
            "on_chain_score": int(self.pool.functions.getTrustScore(addr).call()),
            "history": {
                "finished_loans": finished,
                "repaid_loans": len(repaid),
                "defaulted_loans": len(defaulted),
                "transactions": len(tx_times),
                "vouches_received": len(received),
                "vouches_given": len(given),
            },
            "trust_features": {
                "repayment_history": (len(repaid) / finished) if finished else 0.0,
                "repayment_speed": (sum(c["speed"] for c in repaid) / len(repaid)) if repaid else 0.0,
                "voucher_quality": float(voucher_quality),
                "loan_to_repayment_ratio": min(1.5, total_repaid / total_principal) if total_principal else 0.0,
                "vouch_network_balance": min(2.0, (len(given) + 1) / (len(received) + 1)),
                "transaction_frequency": float(tx_per_month),
            },
            "fraud_features": {
                "vouch_requests_24h": len(recent),
                "avg_voucher_account_age_days": float(avg_voucher_age),
                "network_clustering_score": float(clustering),
            },
            "schedule_features": (
                {"tx_per_month": float(tx_per_month), "avg_days_between_tx": float(avg_gap_days)}
                if avg_gap_days is not None else None
            ),
        }


_reader: ChainReader | None = None
_reader_made_at = 0.0


def get_reader() -> ChainReader:
    """One shared reader. It is rebuilt every 5 minutes, so an RPC restart heals by itself."""
    global _reader, _reader_made_at
    if _reader is None or time.time() - _reader_made_at > 300:
        _reader = ChainReader(load_config())
        _reader_made_at = time.time()
    return _reader
