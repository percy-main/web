# E2E Testing Design

## Scope

Auth flow (registration, email verification, login, logout, forgot password) and donation checkout with Stripe payment verification.

## Framework

Playwright with `@playwright/test`, running against the Astro dev server (`localhost:4321`).

## Project Structure

```
e2e/
  fixtures/
    auth.ts          -- shared fixture: test user creation, login helper, email reader
  tests/
    auth.spec.ts     -- registration, email verification, login, logout
    donation.spec.ts -- donation checkout via Stripe, API verification
  helpers/
    email.ts         -- read .emails/ dir, extract verification URLs
    stripe.ts        -- Stripe API client for verifying payments
playwright.config.ts
```

## Dev Server

Playwright's `webServer` config starts `npm run dev` and waits for `localhost:4321`. Tests use the same local SQLite DB (`file:local.db`) the dev server uses.

A `globalSetup` clears test user data between runs.

## Auth Flow Tests

### Registration + Email Verification + Login

1. Navigate to `/auth/register?name=Test+User&email=test-e2e@example.com`
2. Fill in password, submit
3. Expect redirect to `/auth/registered`
4. Read latest `.html` from `.emails/`, extract verification URL
5. Navigate to verification URL, expect redirect to `/auth/email-confirmed`
6. Navigate to `/auth/login`, fill in credentials, submit
7. Expect redirect to `/members`

### Login with invalid credentials

1. Navigate to `/auth/login`
2. Submit wrong credentials
3. Expect error message

### Logout

1. Log in via fixture (seeded user)
2. Navigate to `/auth/logout`
3. Confirm redirect to home or login

### Forgot password

1. Navigate to `/auth/login`, click "Forgot password?"
2. Enter email, submit
3. Read reset email from `.emails/`, extract URL
4. Navigate to URL, enter new password
5. Login with new password, expect success

### Auth Fixture

Reusable `login` helper that creates a verified user directly in the DB (Kysely), then calls `/api/auth/sign-in/email` to get a session cookie. Used by tests needing authenticated state without going through the UI.

## Donation Checkout Tests

### Complete donation via Stripe embedded checkout

1. Navigate to `/purchase/price_1PHSBTIoYmCDxYlkBoo86Xdb` (dev donation price)
2. Wait for Stripe embedded checkout iframe to mount
3. Use `frameLocator` to enter the iframe
4. Fill test card: `4242 4242 4242 4242`, future expiry, any CVC
5. Click Pay
6. Wait for success state
7. Verify via Stripe API: list recent checkout sessions, find matching one, assert `payment_status === "paid"`

No automatic refunds -- test mode charges are free.

### Stripe Helper (`e2e/helpers/stripe.ts`)

Thin wrapper around Stripe SDK with `STRIPE_SECRET_KEY`. Exposes `findRecentCheckoutSession(filter)`.

## CI: GitHub Actions

**Workflow:** `.github/workflows/e2e.yml`

- Triggers on push to `main` and PRs
- Steps: checkout, setup Node, `npm ci`, `npx playwright install --with-deps chromium`, create `.emails/`, run tests
- Uploads Playwright HTML report as artifact on failure
- Chromium only (add more browsers later if needed)

**Secrets (GH Secrets, not committed):**
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_RP_ID`, `BETTER_AUTH_RP_NAME`
- `DB_SYNC_URL` = `file:local.db`
- Contentful tokens (`CDN_TOKEN`, `CDN_CMA_TOKEN`, `CDN_SPACE_ID`, etc.)
