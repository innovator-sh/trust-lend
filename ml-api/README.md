# TrustLend ML API

A small Python service that gives **advisory** risk estimates for a wallet. It is separate from
the smart contracts. Its output **never** changes the on-chain trust score, the borrowing limit, or
any database row. The on-chain score comes only from the rules in `LendingPool.sol`.

> **Honest status.** No real repayment history exists yet. Both model sets are trained on
> synthetic or unverified data. They show that the pipeline works. They are not evidence of
> accuracy on real borrowers.

## What it does

| Endpoint | Method | Technique | Output |
| :-- | :-- | :-- | :-- |
| `/api/v1/trust-score` | POST | Random Forest classifier (scikit-learn) | Score 0-100, suggested limit, per-feature explanation |
| `/api/v1/fraud-check` | POST | 2 hard rules + Isolation Forest (scikit-learn) | Flagged or not, with reasons |
| `/api/v1/repayment-schedule` | POST | K-Means clustering (scikit-learn) | Earner archetype and a suggested schedule |
| `/api/v1/interest-rate` | POST | **A formula, not a model** | Suggested rate in percent (advisory) |
| `/api/v1/wallet/{address}/assessment` | GET | All of the above, with inputs read from the chain | Full assessment for one wallet |
| `/api/v1/model-info` | GET | none | Where the models came from and how they were measured |
| `/health` | GET | none | Service and model-set status |

## How the trust score is derived

1. Six features describe a borrower (table below).
2. A Random Forest (150 trees, depth 10) outputs the probability that the borrower repays, class 1.
3. **Score = round(100 x that probability)**, limited to 0-100.
4. The suggested limit uses the same bands as the contract: below 20 = $0, then $10 / $50 / $200 / $500 at 20 / 40 / 60 / 80.
5. Each feature is explained by replacing its value with a neutral one and measuring how far the score moves. A positive number means the feature raised the score.

| Feature | Scale | Meaning |
| :-- | :-- | :-- |
| `repayment_history` | 0-1 | Repaid loans divided by finished loans |
| `repayment_speed` | 0-1 | How early loans were repaid: (due date - repayment time) / (due date - loan start) |
| `voucher_quality` | 0-100 | Average current on-chain trust score of the wallet's vouchers |
| `loan_to_repayment_ratio` | 0-1.5 | Money repaid divided by money borrowed (finished loans) |
| `vouch_network_balance` | 0-2 | (Vouches given + 1) / (vouches received + 1). 1 = balanced |
| `transaction_frequency` | 0-100 | Loan and repayment transactions per month |

The scales follow what the **original** models were trained on. Other scales give wrong scores
(for example, the original model splits `voucher_quality` between 20 and 100).

## Where the inputs come from

`/wallet/{address}/assessment` builds every input from the chain, so the browser cannot choose them.
It reads `LendingPool` events (`LoanDisbursed`, `RepaymentMade`, `LoanDefaulted`, `PoolDeposit`,
`BorrowerRegistered`), `VouchSystem` events (`VouchStaked`) and the on-chain trust scores of the vouchers.

Two inputs are **proxies**, because a plain RPC does not hold the exact value:

- `avg_voucher_account_age_days` is the time since each voucher's first activity on TrustLend, not the
  real account age. A wallet created and used for the first time today looks new.
- `network_clustering_score` is the share of possible vouch links among the vouchers that exist. It needs
  at least 3 vouchers. With fewer it is 0, because two linked wallets always score 0.5.

A wallet with **no finished loan** gets no trust estimate ("insufficient history"). A wallet with
**no vouches** gets no fraud check. A repayment pattern needs at least 4 transactions.

## Fraud check

1. More than 10 vouches in 24 hours is flagged (hard rule).
2. Vouchers with an average age under 7 days are flagged (hard rule).
3. An Isolation Forest trained on normal wallets flags unusual combinations of the three inputs.

## Two model sets

Choose with `ML_MODEL_SET` (default `retrained`).

| | `retrained` (default) | `original` |
| :-- | :-- | :-- |
| Source | `training/train.py`, reproducible | The team's first prototype files |
| Training data | Synthetic, documented in `training/synth_data.py` | Unknown. Script and data are not available |
| Trust model | Random Forest, 150 trees | Random Forest, 100 trees, depth 10 |
| Anomaly model | Isolation Forest, contamination 0.02 | Isolation Forest, contamination **0.1** |
| Schedule model | K-Means, 3 clusters | K-Means, 3 clusters |
| Measured | Yes (below) | No |

Known problems of the `original` set, found while inspecting it:

- Contamination 0.1 means it flags about 10% of its own training wallets as anomalies by design. A normal wallet with a closed-ring score of 0 (outside its training range) is flagged too.
- It scores a borrower with one repaid and one defaulted loan at 83 with a $500 limit. The retrained model gives 50 and $50 for the same inputs.
- The earlier prototype UI sent it features on the wrong scale (`voucher_quality` 0-1 instead of 20-100), which made its scores unreliable.

Every model file is loaded only if its SHA-256 matches `models/<set>/metadata.json`. `joblib` files are
pickles and loading one can run code, so the hash check keeps the server to the reviewed files.
The original files were inspected with a restricted reader that allows only numpy, scipy and scikit-learn
classes (`training/register_original.py`).

## Measured quality of the retrained set (synthetic data)

From `models/retrained/metadata.json`:

| Model | Result |
| :-- | :-- |
| Trust (Random Forest) | AUC 0.78 and Brier 0.19 against noisy labels. Mean error against the known true probability: 0.042 |
| Fraud (Isolation Forest) | 2.0% false positives on normal wallets. 100% detection of synthetic sybil rings |
| Schedule (K-Means) | 98.4% of synthetic earners put in the right archetype. Adjusted Rand index 0.95 |

These numbers show that each model learned its **synthetic rules**. The labels come from the weighted
sum in `training/synth_data.py` (weights: history 30%, speed 20%, voucher quality 15%, repaid ratio 15%,
vouch balance 10%, activity 10%). Real borrowers may behave differently.

## Run it

```bash
cd ml-api
python -m venv .venv
.venv/Scripts/activate          # Windows. On macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --port 8000
```

The chain reader uses the addresses in `src/contracts/addresses.js` and the RPC at `http://127.0.0.1:8545`.
Start a local node and deploy first (`cd blockchain && npm run node`, then `npm run deploy:local`).
In the app, set `VITE_ML_API_URL=http://localhost:8000` in `.env.local`.

| Variable | Default | Purpose |
| :-- | :-- | :-- |
| `ML_MODEL_SET` | `retrained` | `retrained` or `original` |
| `ML_RPC_URL` | `http://127.0.0.1:8545` | Chain RPC |
| `ML_POOL_ADDRESS`, `ML_NFT_ADDRESS`, `ML_VOUCH_ADDRESS` | from `addresses.js` | Contract addresses |
| `ML_FROM_BLOCK` | `0` | First block to scan for events (set the deploy block on a live network) |
| `ML_LOG_CHUNK` | `5000` | Blocks per log request |
| `ML_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | CORS origins, comma separated |
| `ML_RATE_LIMIT_PER_MIN` | `60` | Requests per IP per minute |

## Retrain or re-register

```bash
python -m training.train                                  # trains the retrained set and writes metadata.json
python -m training.register_original "<folder with the 3 original .joblib files>"
```

After retraining, commit the new `models/retrained/` files together with `metadata.json`.

## Tests

```bash
python -m pytest -q
```

31 tests run against both model sets: score ordering and range, limit bands equal to the contract,
input validation, fraud rules, schedule archetypes, a tampered model file is refused, CORS, and the
wallet assessment (including no history, no vouches and an unreachable chain).

## Limits and next steps

- Replace the synthetic generators with real repayment data when it exists, then re-measure.
- The service has no login. It is read-only advice about public chain data, with CORS limits and a rate limit. Put it behind a proper gateway before a public launch.
- Event scans read the whole history from `ML_FROM_BLOCK`. For a busy network, use an indexer.
- The `interest-rate` endpoint is a formula and conflicts with the fixed contract rates (7.1% and 4.2%). It is advice only and the app does not show it.
- Do not feed a score from this service into the contract without a design for who may publish it, how it is audited, and how a wrong score is reversed.
