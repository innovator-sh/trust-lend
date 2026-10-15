# TrustLend

TrustLend is a decentralized micro-lending platform on Polygon. Users lend and borrow money directly with each other. The platform uses on-chain reputation. It does not use collateral or credit bureaus.

A borrower builds a trust score with repayments and vouches from other users. Lenders put money into a shared pool. Each lender earns yield in proportion to the amount deposited. The platform records each loan, repayment, and score change on the blockchain.

## How it works

1. The user connects a wallet (MetaMask) and completes the onboarding.
2. The trust score of the borrower sets the borrowing limit. Scores of 30 to 100 give limits of $10 to $500.
3. Other users can vouch for a borrower. To do this, they stake tokens.
4. If the borrower repays the loan, the platform returns the stake. If the borrower does not repay, the platform takes the stake (slash).
5. The borrower requests a loan from the pool and repays it on schedule. Each repayment changes the trust score automatically.
6. The platform stores the reputation as a non-transferable NFT. The NFT stays with the wallet. Anyone can audit it.

## Tech stack

| Layer | Technology |
| :-- | :-- |
| Frontend | React 19, Vite, Tailwind CSS, Framer Motion, D3 (trust network graph) |
| State and i18n | Zustand, i18next (English, Hindi, Gujarati, Marathi) |
| Web3 | ethers v6 |
| Contracts | Solidity 0.8.25, Hardhat, OpenZeppelin 5 |
| Network | Polygon Amoy testnet, local Hardhat node for development |
| Off-chain data | Supabase (user profiles) |

## Smart contracts

The contracts are in [blockchain/contracts](blockchain/contracts):

- **LendingPool** - manages the pool funds as lender shares, the loan life cycle, interest, borrowing limits that depend on the trust score, defaults, and lender yield.
- **VouchSystem** - lets users stake tokens to support a borrower. The pool returns the stakes when the borrower repays and slashes them on default.
- **ReputationNFT** - stores the trust score and the reputation record on the blockchain.
- **TrustToken** - the platform token. It has a test faucet, so use it on test networks only.
- **StableToken** - a test stablecoin. The current deploy script does not use it.

## Getting started

Before you start, make sure that you have Node.js 20 or later and a browser wallet.

```bash
git clone https://github.com/innovator-sh/trustlend.git
cd trustlend
npm install
cp .env.example .env.local   # then add your Supabase URL and publishable key
npm run dev
```

The app starts at http://localhost:5173.

### Database setup

1. Create a project in Supabase.
2. Open the SQL Editor and run `supabase/schema.sql`.
3. Put the project URL and the publishable key in `.env.local`. Do not use the secret key.

### Running the contracts locally

```bash
cd blockchain
npm install
cp .env.example .env        # fill in your own keys; never commit .env
npm run node                # terminal 1: local chain
npm run deploy:local        # terminal 2: deploy contracts
npx hardhat run scripts/setupDemo.js --network localhost   # optional: seed demo accounts
npm test                    # run the contract tests
```

The deploy script writes the contract addresses to `blockchain/deployed.json`. The frontend gets its ABIs and addresses from `src/contracts/`.

### Scripts

| Command | Purpose |
| :-- | :-- |
| `npm run dev` | Start the development server |
| `npm run build` | Make a production build |
| `npm run preview` | Start a local server for the production build |
| `npm run lint` | Do a check of the code with ESLint |

## Project structure

```text
trustlend/
├── blockchain/          Hardhat workspace (contracts, deploy scripts)
├── public/              Static assets, PWA manifest, service worker
└── src/
    ├── components/      Shared UI components
    ├── context/         Wallet, theme and demo-mode providers
    ├── contracts/       ABIs and deployed addresses used by the app
    ├── hooks/           Contract and transaction hooks
    ├── i18n/            Translations
    ├── lib/             Supabase and blockchain helpers
    └── pages/           Route-level screens
```

## Roadmap

- Add a test suite for the contracts
- Add support for more than one blockchain
- Improve the PWA for mobile devices
- Add detection of fraud and sybil attacks in vouching
- Add more currencies and stablecoins

## License

This project is for academic and educational use only.
