# Deploy TrustLend to Polygon Amoy

This guide puts the contracts on the Polygon Amoy test network and the app and ML service online.
Amoy uses test coins with no money value. Nothing here needs real funds.

## Rules before you start

- Never commit a private key, API key or `.env` file. Use placeholders in files that go to git.
- Run `bash scripts/check-secrets.sh --worktree` before every push. The pre-push hook also runs it.
- Use a **new** wallet only for this deploy. Do not reuse a wallet that held real funds.

## 1. Make a deploy wallet

1. In MetaMask, create a new account. Export its private key.
2. Get free test POL for that address from the Polygon Amoy faucet.
3. Copy `blockchain/.env.example` to `blockchain/.env` and set only `PRIVATE_KEY_DEPLOYER`.
   `blockchain/.env` is ignored by git. Keep it that way.

## 2. Deploy the contracts

```bash
cd blockchain
npm test                  # all tests must pass
npm run deploy:amoy
```

The script deploys the four contracts, links them, seeds the pool with 500,000 TRUST through
`depositToPool`, and writes these files:

| File | Content |
| :-- | :-- |
| `src/contracts/addresses.js` | Contract addresses, `CHAIN_ID` 80002, `DEPLOY_BLOCK`, explorer URL |
| `src/contracts/*.json` | ABIs |
| `blockchain/deployed.json` | Record of the deploy |

These files hold public data only. Commit them. The app and the ML service read the addresses from here.

Optional: verify a contract on Polygonscan with `npm run verify:amoy -- <address> <constructor args>`.
This needs `POLYGONSCAN_API_KEY` in `blockchain/.env`.

## 3. Host the app (Vercel)

1. Import the GitHub repository in Vercel. Framework: Vite. Build command: `npm run build`. Output folder: `dist`.
2. Set these environment variables in the project settings (not in git):

| Name | Value |
| :-- | :-- |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_KEY` | The publishable key (never the service-role key) |
| `VITE_ML_API_URL` | The public URL of the ML service from step 4 |

The app uses a hash router, so no rewrite rules are needed.

## 4. Host the ML service

Use any host that runs a Docker image (Render, Railway, Fly.io). The Dockerfile needs the repository
root as its build context, because the service also reads `src/contracts`.

```bash
docker build -f ml-api/Dockerfile -t trustlend-ml .
```

On Render: new Web Service, runtime Docker, Dockerfile path `ml-api/Dockerfile`, root directory = repository root.

Set these variables on the host:

| Name | Value |
| :-- | :-- |
| `ML_RPC_URL` | `https://rpc-amoy.polygon.technology` |
| `ML_FROM_BLOCK` | The `DEPLOY_BLOCK` from `src/contracts/addresses.js` |
| `ML_ALLOWED_ORIGINS` | The public URL of the app, for example `https://your-app.vercel.app` |
| `ML_MODEL_SET` | `retrained` |

Then set `VITE_ML_API_URL` in Vercel to the ML service URL and redeploy the app.
The ML service gives advice only. It never writes to the chain or the database.

## 5. Check the live app

1. Open the app. The landing page must show the pool liquidity (about 500,000 TRUST).
2. Connect MetaMask on Polygon Amoy and sign in. Use **Claim TRUST** in the header to get test tokens.
3. Finish onboarding. The borrow limit must read $10.
4. Borrow, then repay. Open the transaction link: it must open on Polygonscan.
5. Open **Credit Profile**. The ML card must show an estimate or say that a finished loan is needed.
6. Open **Transactions** and **My Portfolio**. Both must list the real transactions.

## 6. Before the repository goes public

- Run `bash scripts/check-secrets.sh --worktree` and `--head`.
- Make sure no old commit holds a private key or a personal email address (see `CLAUDE.md`, Guardrails).
- Delete any old repository that still serves a commit with a secret.
