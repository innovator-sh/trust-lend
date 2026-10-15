# TrustLend risk model

**Status: a starting rule, not a measured model.** The numbers below are design choices.
No repayment data supports them yet. This file says what the rules are, why they exist,
what is not measured, and how the rules should change when data exists.

## The rules today (in `blockchain/contracts/LendingPool.sol`)

| Rule | Value | Why this value |
| :-- | :-- | :-- |
| Starting score | 30 | A new wallet has no history. 30 sits in the lowest band that can borrow. |
| Minimum score to borrow | 20 | A wallet that defaulted (score drops by 15) falls below this and is blocked. |
| Limit, score 20-39 | $10 | The entry loan is small on purpose. A loss on a new wallet stays small while the platform learns. |
| Limit, score 40-59 | $50 | About 5x the entry loan. |
| Limit, score 60-79 | $200 | About 4x the previous band. |
| Limit, score 80-100 | $500 | The top band. No higher band exists until data supports one. |
| Score after full repayment | +12 early, +8 on time, +3 late | Rewards early and on-time repayment more than late repayment. |
| No bonus if repaid within 1 day | 0 | Stops quick borrow-and-repay score farming. |
| Score after default | -15 | A default costs more than one on-time repayment gives back. |
| Interest | 7.1% (reputation only), 4.2% (vouch backed) | The vouch rate is lower because a stake backs the loan. These rates are not derived from loss data. |

Why a score of 30 gives $10: the answer is that $10 is the smallest loan tier, and a new
wallet starts in it. It is a risk-containment choice, not a calculation.

## What is not measured

- The probability of default for any score band.
- Whether the interest rates cover expected losses.
- Whether the +12 / +8 / +3 / -15 steps match real repayment behaviour.
- Whether a vouch lowers risk.

Do not claim otherwise. Earlier versions of the app showed a "0.3% default rate", "AI
underwriting" and "AI trust assessment" text. Those were fixed sample values and were removed.

## What is measured now

The contract counts loans issued, repaid and defaulted
(`totalLoansIssued`, `totalLoansRepaid`, `totalLoansDefaulted`) and exposes
`getDefaultRate()`. The Landing page shows this measured rate, or "No data yet" until at
least one loan is finished.

## How the rules should change when data exists

1. Collect at least a few hundred finished loans per band before changing a limit.
2. Compute the default rate and the loss per band. Raise a limit only where the measured
   default rate is low and stable. Lower or remove a band where it is high.
3. Set the interest rate per band from the measured loss rate plus costs.
4. Re-fit the score steps (+12, +8, +3, -15) against repayment outcomes.
5. Move the constants behind owner-set parameters with events, so a change is public and
   needs no redeploy. Do this only after step 1, because a parameter that anyone can change
   is also a risk.

## Known weaknesses

- **Fake identities (sybil).** One person can use many wallets. The 1-day rule, the minimum
  stake, the cap of 10 active vouches per borrower and the cap of 20 active stakes per
  voucher make this slower and costlier. They do not stop it. Real protection needs a proof of
  unique person (for example, verified KYC) and a minimum repaid-loan history for vouchers
  (`VouchSystem.setMinVoucherRepaidLoans`, off by default, on for non-test networks in
  `deploy.js`).
- **Faucet.** TRUST can be claimed free on test networks. A stake of free tokens costs
  nothing. The faucet is switched off on non-test networks.
- **One owner wallet.** The owner can set any score. Production needs a multisig.
- **Flat interest.** Interest does not depend on the loan term (1 to 365 days).
