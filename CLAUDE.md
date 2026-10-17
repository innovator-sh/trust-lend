# TrustLend

Decentralized micro-lending dApp on Polygon: React/Vite frontend plus a Hardhat contracts workspace. Borrowing limits come from an on-chain trust score and peer vouching.

## Commands
- Install: `npm install` (frontend), `cd blockchain && npm install` (contracts)
- Dev server: `npm run dev`
- Build / preview: `npm run build` / `npm run preview`
- Lint: `npm run lint`
- Contracts (run inside `blockchain/`): `npm run compile`, `npm run node`, `npm run deploy:local`, `npm run deploy:amoy`
- There is no test suite yet. `npm run lint` currently reports pre-existing errors (mostly unused vars); do not add new ones, and verify changes with `npm run build`.

## Conventions
- JavaScript with JSX (no TypeScript). ESM in the frontend (`"type": "module"`), CommonJS in `blockchain/`.
- Styling is Tailwind plus the shared tokens in `src/index.css` and `src/trustlend.css`. Reuse the existing components in `src/components/` before adding new ones.
- All user-facing strings go through i18next. Add every new key to all four files in `src/i18n/locales/` (`en`, `hi`, `gu`, `mr`).
- Contract calls go through the hooks in `src/hooks/`. Map revert reasons with `src/utils/contractErrors.js` and surface transactions with `src/utils/txToast.jsx`.

## Layout (non-obvious parts)
- `src/contracts/` holds the ABIs and `addresses.js` the app consumes. After redeploying contracts, update these from `blockchain/artifacts` and `blockchain/deployed.json`.
- `src/lib/contracts.json` and `src/contracts/*.json` are generated/copied data; edit the Solidity or the deploy output, not these files by hand.
- Routes are declared in `src/App.jsx`; everything except `/`, `/connect` and `/onboarding` sits behind `ProtectedRoute`.
- `blockchain/contracts/`: `LendingPool` (core), `VouchSystem`, `ReputationNFT`, `TrustToken`, `StableToken`.

## Pitfalls
- Never commit `blockchain/.env` or any `.env.*` other than `.env.example`. Deployer, borrower, lender and voucher private keys live there.
- `blockchain/cache/` is a local Hardhat cache with absolute paths; it is gitignored. `blockchain/artifacts/` is committed on purpose because the frontend copies ABIs from it.
- Contracts are compiled with `viaIR` and the `cancun` EVM target (Solidity 0.8.25). Changing either alters bytecode and deployed addresses.
- Supabase URL and key come from `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` in `.env.local` (gitignored). The schema is `supabase/schema.sql`. Its RLS policies are open prototype policies. The app collects no personal data (no phone, email, address, income or ID numbers): do not add such fields until the policies are replaced.
- Pool accounting uses shares (`LendingPool.sol`). Add liquidity only with `depositToPool` (or `addRecovery`). Tokens sent straight to the contract are not counted. Seed pools in `deploy.js` the same way.
- `LoanStatus.Active` is enum value 0, which is also the value of an empty record. Always check `loan.amount > 0` with the status.
- Score rules: a wallet starts at 30 on its first loan request, a score below 20 cannot borrow, a repayment within 1 day of the loan start gives no bonus, `markDefault` works only after the due date. The Collateral path (1) is disabled. VouchBacked (0) needs 5 TRUST of active vouch stake.
- Run `cd blockchain && npm test` after any contract change. After a change to a function signature, run `npm run deploy:local` so `src/contracts/*.json` refresh.
- The tier table lives only in `src/utils/constants.js` (re-exported by `src/lib/supabase.js`). It must match `LendingPool.getBorrowLimit`: $10 / $50 / $200 / $500 at scores 20 / 40 / 60 / 80. Change both together.
- Addresses come only from `src/contracts/addresses.js` (written by `deploy.js`). Do not add a second address file.
- Sign-in is a signed message in `src/lib/session.js`. Use `getValidSession()`, not `sessionStorage` values, to know who is signed in.
- Loans above $10 need `users.kyc_status = 'verified'`. Only the database owner can set it, and a browser request cannot change `kyc_status`, `trust_score` or `tier` (trigger in `supabase/schema.sql`). Re-run the schema after changes. The score the app uses is the on-chain one.
- `ml-api/` is a separate Python service (FastAPI + scikit-learn). Its scores are advisory only: never write an ML score to the contract, Supabase or the store. Commands (from `ml-api/`): `pip install -r requirements-dev.txt`, `uvicorn app.main:app --port 8000`, `python -m pytest -q`, `python -m training.train`. The browser reads it through `src/lib/mlApi.js` (`VITE_ML_API_URL`) and shows `MlAssessmentCard`. There is no mock fallback: when the service is off, the card says so.
- ML model files (`*.joblib`) are pickles. Load them only through `ml-api/app/model_store.py`: it checks the SHA-256 in `models/<set>/metadata.json` and then loads through `ml-api/app/safe_pickle.py`, which refuses any class outside a short allowed list. Never call plain `joblib.load` on a repo file, never add a class to the list without a reason, and never commit a model file whose training data you cannot name. `ml-api/models/original/` is gitignored on purpose. After retraining, commit the new files with their `metadata.json`.
- Keep ML feature scales as documented in `ml-api/app/features.py`. The models need `voucher_quality` 20-100, `vouch_network_balance` 0-2, and so on (the scales of the first prototype, which the retrained models keep).
- Do not add fixed statistics or claims such as "AI", "guaranteed" or "default rate" to the UI. Show numbers from the contract, or label the text as sample data.
- Local chain id is 31337 and Amoy is 80002; `NetworkGuard` blocks other networks.
- `useWallet()` returns `walletAddress`, not `address`. `ConnectWallet` must call `connectWallet()` after the signature, or the pages see no provider until a reload. A hook that reads the chain must check the loan status, not only the amount.
- Activity lists (Transactions, lender activity) read contract events through `src/lib/chainEvents.js` in chunks from `ADDRESSES.DEPLOY_BLOCK`. Do not add mock lists.
- Browser check: `blockchain` node + `npm run deploy:local` + `npm run dev`. A scripted run uses a fake `window.ethereum` that forwards to the local node (hardhat accounts are unlocked). The app writes to the real Supabase project, so use test wallets only.

## Guardrails
- Never commit or push keys, API keys, private keys, seed phrases, tokens or `.env` files. Use placeholders (`your_private_key_here`) in every committed file, including `.env.example`, docs, tests and scripts.
- Before every push, run `scripts/check-secrets.sh --range origin/main..HEAD` and `scripts/check-secrets.sh --worktree`. Do not push if either fails. A local `pre-push` hook runs the range check; install it with `cp scripts/pre-push.sample .git/hooks/pre-push` on a new clone.
- Real values live only in gitignored files (`.env.local`, `blockchain/.env`). The repo will become public, so treat every pushed commit as public.
- If a real secret reaches a pushed commit, treat it as compromised: rotate it first, then remove it from history.

## Workflow
- Write a short spec in `specs/` before any feature touching more than two files; plan first for contract changes.
- Run `npm run build`, `npm run check:i18n` (fails when a `t()` key is missing from `en.json`) and lint the files you touched before every commit.
- Commit messages: single-line subject, blank line, then details. No trailers or attribution lines.
- Claude Code feature usage (context, skills, subagents, MCP, hooks): use the `claude-code-playbook` skill, opening only the topic file needed.
