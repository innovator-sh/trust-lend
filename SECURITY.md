# Security

TrustLend is a testnet prototype. It holds no real money and collects no personal data.

## Report a problem

Please open a private security advisory on GitHub (Security tab, "Report a vulnerability"). Do not
post secrets or exploit details in a public issue.

## Things to know before you run the code

- `ml-api/models/**/*.joblib` are pickle files. A pickle can run code when it is loaded. The ML
  service loads them only through `ml-api/app/safe_pickle.py`, which accepts a short fixed list of
  classes. Do not load these files with plain `joblib.load`, and do not accept model files from
  people you do not trust.
- The contracts are not audited and one owner key holds admin powers. Use test networks only.
- The database policies are open prototype policies. Do not store personal data in this app.
- Never commit private keys, API keys or `.env` files. Run `bash scripts/check-secrets.sh --worktree`
  before every push.
