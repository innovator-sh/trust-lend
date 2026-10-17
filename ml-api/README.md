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

The scales follow the scales the first prototype used, which the retrained models keep. Other scales
give wrong scores (for example, `voucher_quality` runs from 20 to 100).

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

## Model sets

The service ships one set, `retrained`, and uses it by default (`ML_MODEL_SET=retrained`).

| | `retrained` (shipped) |
| :-- | :-- |
| Source | `training/train.py`, reproducible |
| Training data | Synthetic, documented in `training/synth_data.py` |
| Trust model | Random Forest, 150 trees |
| Anomaly model | Isolation Forest, contamination 0.02 |
| Schedule model | K-Means, 3 clusters |
| Measured | Yes (below) |

An `original` set (the files from the team's first prototype) is **not shipped** in this repository.
Nobody has the training script or the training data, so the files cannot be rebuilt or checked, and
a trained model can reveal facts about its training data. The folder `models/original/` is gitignored.
The code can still use such a set if you register your own trusted copy
(`python -m training.register_original "<folder>"`, then `ML_MODEL_SET=original`). If the set is not
installed, the API answers 503 with a clear message.

Problems found in the original set before it was removed: its anomaly model flagged about 10% of
its own training wallets by design (contamination 0.1), it scored a borrower with one repaid and one
defaulted loan at 83 with a $500 limit (the retrained model gives 50 and $50), and the earlier
prototype UI sent it features on the wrong scale.

## Safe loading of model files

A `joblib` file is a pickle, and loading a normal pickle can run any code the file names. Two checks
protect the server before a file is used:

1. **Hash check.** The file's SHA-256 must match `models/<set>/metadata.json`. This catches a file
   that changed by accident.
2. **Allowed-class check** (`app/safe_pickle.py`). The loader refuses any class outside a short list:
   six scikit-learn model classes and five numpy and joblib helpers that rebuild arrays. A file that
   asks for anything else is refused before that code is created. This stops a file that was swapped
   on purpose, even when its hash in `metadata.json` was swapped too.

`tests/test_safe_pickle.py` proves both: a file that would call a function is refused and the function
does not run, and so is a swapped file with a matching hash. The same test fails if a retrained file
needs a class that is not on the list.

Rules for anyone who contributes a model file:
- Never accept a model file from someone you do not trust, and never load one with plain `joblib.load`.
- A pull request that changes `models/` or `app/safe_pickle.py` needs a review by the maintainer
  (see `.github/CODEOWNERS`).
- After retraining, commit the new files with their `metadata.json`. If the allowed-class test fails,
  read why before you add a class to the list.

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
| `ML_MODEL_SET` | `retrained` | `retrained`, or `original` if you register your own trusted copy |
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
