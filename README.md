# ApexRig — connected accounting suite

This version adds **Suite → Company books**, a transactional SQLite accounting workspace. Read [TRANSACTIONAL-BOOKS.md](TRANSACTIONAL-BOOKS.md) for supported workflows, migration boundaries and remaining work. It does not complete all 110 requested sections. Store checkout still uses the legacy books; do not treat the new ledger as a completed production cutover.

Use Node.js 24 LTS. Back up your existing store_data.json and export ERP browser data before replacing an installation.

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local`. Set a NEW strong `OWNER_PASSWORD`, and set rotated `GEMINI_API_KEY` / `TRACK123_API_KEY` if needed. Do not commit secrets.
3. Run `npm run dev`, then open http://localhost:3000.
4. Sign in as `sheedatalli` with your configured owner password.

To verify and run the production build:

```sh
npm run lint
npm run build
npm test
npm start
```

The build creates `dist/` and `dist-server/`. Build before running the HTTP integration tests. Tests use disposable data and do not contact Gemini or Track123.

## Configuration and data

- Runtime environment variables take precedence over `.env.local`, which takes precedence over `.env`.
- `PORT` defaults to 3000. `DATA_FILE` optionally selects a persistent writable data-file path.
- Run ONE server process against this JSON file. Multi-instance database transactions are not implemented.
- Serve the frontend and API from the same origin. Set `COOKIE_SECURE=true` when deployed behind HTTPS. Set `APP_URL` to the exact app origin when needed.
- Sessions expire after eight hours and are lost on server restart. Sign in again after restarting.
- The included store_data.json retains the supplied archive's business records. Its owner passwords have been cleared; configure the owner through the environment. Other stored passwords were hashed in the delivered copy. Rotate credentials previously exposed in source.
- Some ledger, journal and configuration data still lives in browser storage. Export it before clearing browser data or changing computers. The original ZIP was not modified.

## Connected ERP workspace

Open the admin backend → Apex ERP Suite. Add customers/suppliers, save document drafts, approve them, and record linked receipts or supplier payments. Open Administrator access to assign staff permissions. Existing staff default to read-only until the owner grants more access.

Read ACCOUNTING-UPGRADE.md for workflows, validation and deployment boundaries. FASTACCOUNTS-RESEARCH.md contains official research sources and the feature coverage/gap matrix. REPAIR-NOTES.md documents the earlier repair pass.

The new activity ledger uses server records. It does not silently import historical browser-only journals or opening balances. Reconcile these before treating the reports as complete financial statements. Physical inventory remains managed through stock intake and website-order fulfillment.
