# Doxxus Commerce API

Node.js backend foundation for the Doxxus commerce and client portal MVP.

## Current scope

- `GET /health` confirms that the service is running.
- Stripe checkout, signed webhooks, authentication, and database routes are intentionally not enabled yet.
- Secrets belong in environment variables and must never be committed.

## Run locally

```bash
cd server
npm start
```

Then request `http://localhost:3000/health`.
