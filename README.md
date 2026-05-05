# Live Auctions

Live Auctions is a multi-tenant live auction platform for independent auction houses. It gives sellers a live console for running lots in real time, and gives buyers a mobile-first bidding experience that works across multiple houses with one buyer account.

## Product

- **Platform home**: a house-agnostic buyer login and unified order dashboard.
- **Tenant storefronts**: branded house pages such as `basa.localhost` and `unsoundrags.localhost`.
- **Live buyer view**: iPhone-first live lot screen with one-tap bids, custom bids, max bids, bid history, audio listening, and buyer questions.
- **Seller console**: live lot queue, current bid tracking, sell/pass/next-lot controls, audio publishing, buyer question answering, and winner/order creation.
- **Unified buyer account**: buyers use one login across houses and see wins from all tenants in one place.

## Architecture

- **Frontend**: Next.js App Router, React, Tailwind CSS.
- **Backend**: Fastify API in `backend/src`, used for privileged workflows and third-party integrations.
- **Database/Auth**: Supabase Auth, Postgres, RLS, and Realtime.
- **Auction engine**: Basta Management and Client APIs for sale/item publishing and bid placement.
- **Payments**: Stripe payment/setup intents and local webhook verification.
- **Audio**: LiveKit publisher/subscriber token flow for live auction audio.
- **SMS**: Twilio hooks exist but are disabled unless `SMS_ENABLED=true`.

## Local Development

Install dependencies:

```bash
pnpm install
```

Run the frontend and backend together:

```bash
pnpm dev:all
```

Or run them separately:

```bash
pnpm dev
pnpm dev:backend
```

Default local URLs:

- Platform: `http://localhost:3000`
- BASA tenant: `http://basa.localhost:3000`
- UNSOUND RAGS tenant: `http://unsoundrags.localhost:3000`
- Backend health: `http://localhost:4000/health`

## Environment

Frontend env lives in `.env.local`; backend env lives in `backend/.env`.

Required integrations include:

- Supabase URL and publishable key
- Supabase service-role key for the backend
- Basta account/API credentials
- Stripe secret key and webhook secret
- LiveKit URL/API credentials

Stripe webhook testing uses:

```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

## Verification

Core checks:

```bash
pnpm typecheck
pnpm build
pnpm build:backend
```

`npm test` is intentionally not listed because this repo currently has no `test` script.

For end-to-end validation, run a live auction with at least one seller session and multiple isolated buyer sessions. Cover buyer login, one-tap bid, custom bid validation, max bid, live questions, seller answers, sell/pass/next-lot controls, order creation, and the unified platform orders dashboard.
