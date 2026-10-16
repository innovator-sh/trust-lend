# Regulatory position

**This is not legal advice.** It records what the project team understands, so that a
lawyer can review it. Rules change. Verify every point with a qualified Indian financial-services lawyer
before any real launch.

## Current status

TrustLend is a hackathon prototype on a test network. It uses test tokens with no value.
It holds no real money, has no licence, and says so in the app (testnet notice and Terms page).

## What a real launch would face (to the team's understanding)

### Peer-to-peer lending
- In India the Reserve Bank of India (RBI) regulates P2P lending platforms. A platform
  needs registration as an NBFC-P2P and must follow the RBI directions for such platforms.
- The directions, as understood, include: limits on how much one lender can lend and one
  borrower can borrow across platforms; funds moving through an escrow account (not through the
  platform's own account); no guarantee of principal or returns by the platform; and
  disclosure duties.
- A single shared lending pool, as TrustLend uses today, is likely to conflict with
  rules that expect lenders to choose borrowers and with the no-guarantee rule. The model
  would need a legal design (for example, a licensed partner).

### Crypto-assets
- Crypto-assets are not banned in India, but they are not legal tender. Their legal status for
  lending is unclear.
- Gains on virtual digital assets are taxed, and a tax deduction at source applies to
  transfers. Businesses that deal in virtual digital assets are reporting entities under
  anti-money-laundering law.
- A production version would likely use a regulated stable currency or fiat rails through a
  licensed partner, not a free-mint token.

### Personal data and KYC
- The prototype collects no phone number, email, address, income or ID number. It stores a
  wallet address, a display name, a role and loan records. The Digital Personal Data Protection
  Act, 2023 would still apply to a production service that stores personal data.
- Aadhaar numbers have extra limits on who may collect and store them. A production version
  must use a licensed identity provider and store only a verification result. It must not
  store the number.
- In the prototype the database policies are open, so stored data is not private
  (see `supabase/schema.sql`). Do not add personal-data columns until the policies are closed.

## What the project does today to stay honest

| Item | Action |
| :-- | :-- |
| "Principal protected" and "AI" claims | Removed or labelled as sample data |
| Fixed platform statistics | Replaced by numbers read from the contract |
| Test status | Notice on every page and Terms & Privacy page (`/terms`) |
| Faucet | Switched off by `deploy.js` on non-test networks |
| Personal data | Not collected. The onboarding form asks only for a display name and a role |
| Loans above $10 | Need `kyc_status = verified`, which only a database admin can set |
| Sign-in | Signed message, checked again on each protected page |

## Open points for a lawyer

1. Which licence or partner structure fits a pooled lending model?
2. Can lenders pick borrowers, and does the pool need to change to per-loan funding?
3. How should the platform treat the on-chain token for compliance (fiat on and off ramps)?
4. What must the privacy notice and consent flow contain under the DPDP Act?
5. What are the correct limits, disclosures and grievance-handling duties?
