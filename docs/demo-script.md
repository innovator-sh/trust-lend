# Demo script (about 6 minutes)

Use this after the app is running on Amoy (see `docs/deploy.md`) or on a local chain
(`cd blockchain && npm run node`, then `npm run deploy:local`, then `npm run dev`).

## Set up before you present

- Two browser profiles with MetaMask on the same network: **Borrower** and **Lender**.
- The Lender wallet holds TRUST (use **Claim TRUST**, or `node scripts/setupDemo.js` on a local chain).
- The ML service is running, and `VITE_ML_API_URL` points to it.
- Do one full borrow and repay on the Borrower wallet earlier, so the Transactions page has history.

## The story

| Time | Show | Say |
| :-- | :-- | :-- |
| 0:00 | Landing page | "Many people have no credit history, so a bank cannot lend to them. TrustLend lends against reputation. Every number on this page comes from the contract." Point to the pool liquidity and the measured default rate. |
| 0:45 | Connect wallet | "One signature proves I own the wallet. It costs no gas." Show the signed message. |
| 1:15 | Onboarding | "Everyone starts at score 30. The scan reads the real chain. I cannot buy a better start." |
| 1:45 | Borrow | "At score 30, the limit is $10. Interest is flat 7.1%." Take a small loan. Show the transaction on Polygonscan. |
| 2:45 | Repay | Repay. "A repayment in the first day gives no bonus. This stops quick borrow-and-repay farming." Show the real score change. |
| 3:30 | Vouch | Switch to a second wallet and stake TRUST for the borrower. "A vouch costs real stake. It is lost if the borrower defaults." Show the 4.2% vouched rate unlocked. |
| 4:15 | Lender | Switch to the Lender profile. Deposit, then open **My Portfolio**. "Lenders share one pool. Interest raises the value of every share. A default is a shared loss." Withdraw. |
| 5:00 | Credit Profile (ML) | "The ML model is advisory. It estimates trust and checks vouch patterns. It is trained on synthetic data, so it never sets a limit. The contract does." |
| 5:30 | Close | "Everything you saw is on a test network. The risk rules are documented in `docs/risk-model.md`." |

## Questions you should expect

**"Why does a score of 30 give $10? How did you calculate this?"**
It is a starting rule, not a measured model. The limits are $10, $50, $200 and $500 at scores 20, 40, 60 and 80.
The plan is to change them only from observed repayment data. The app shows the measured default rate from the chain.
See `docs/risk-model.md`.

**"One person makes 10 wallets and vouches for himself. What stops this?"**
It is not fully solved. What exists today:
- A voucher puts real TRUST at stake, and loses it on a default.
- A cap on stakes per voucher, and an option to require a repaid loan before a wallet can vouch.
- No score bonus for a repayment in the first day.
- Loans above $10 need a KYC status that only an admin can set.
- The faucet is switched off outside test networks.

What is left: a proof-of-unique-person check and a server-side session. Say this plainly.

**"In India the RBI regulates P2P lending. What about this?"**
TrustLend is a prototype on a test network with no real money. It is not a licensed lender.
A real launch needs an NBFC-P2P licence or a licensed partner, no guaranteed returns, and legal review of crypto lending.
See `docs/regulatory-position.md`. It is a position paper and not legal advice.

**"Is the ML model reliable?"**
No claim of that. It is trained on synthetic data, it is labelled advisory in the app, and it cannot change a score or a limit.

**"What happens if a borrower defaults?"**
After the due date, the contract owner marks the loan as defaulted (only the owner can, and only after the due date).
The unpaid principal is removed from the pool value, so all lenders share the loss. The borrower loses 15 score points
and the vouchers lose their stake. Say that one owner key holds this power today. A multisig is the planned fix.
