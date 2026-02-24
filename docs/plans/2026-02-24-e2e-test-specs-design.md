# E2E Test Specs Design

## Goal

Expand E2E test coverage beyond the existing auth and donation tests to cover homepage structure, full membership signup+payment, members area states, navigation/content pages, and newsletter signup.

## Principles

- **No CMS content assertions** — test structural presence only (sections exist, links point to correct routes) since Contentful content changes independently.
- **Full Stripe interaction** — fill embedded checkout iframes with test card details and verify via Stripe API.
- **Simulate webhooks** — after verifying a Stripe checkout succeeded, POST a signed webhook event to the local server to trigger downstream effects (membership updates, etc.).

## New Test Files

```
e2e/tests/
  homepage.spec.ts       — homepage structural tests
  membership.spec.ts     — full join + register + pay flow
  members-area.spec.ts   — members area tab states
  navigation.spec.ts     — content pages load correctly
  newsletter.spec.ts     — event subscriber signup
```

## New/Extended Helpers

### Stripe Webhook Helper (extend `e2e/helpers/stripe.ts`)

Add `simulateCheckoutWebhook()`:
1. Takes the base URL and a Stripe checkout session object
2. Constructs a `checkout.session.completed` event payload
3. Signs it with `stripe.webhooks.generateTestHeaderString()` using `STRIPE_WEBHOOK_SECRET` from env
4. POSTs to `{baseUrl}/api/stripe_hook` with the `stripe-signature` header

The env var `STRIPE_WEBHOOK_SECRET` is set to `this-is-not-a-secret-value` in `.env.test`. This is intentionally not secret — it only exists so the webhook handler's signature verification passes in the test environment.

### Member Fixture (new `e2e/fixtures/member.ts`)

Extends the auth fixture. Provides a `memberPage` where the user has completed the join form (has a `member` DB record) but has no membership yet. This avoids repeating join-form filling in tests that only need an existing member.

## Test Specs

### 1. `homepage.spec.ts` — Homepage Structure

No CMS content assertions. Structural presence only.

- **Hero section renders** — hero area exists with a heading and CTA
- **Navigation works** — header nav links exist, point to correct routes (/cricket, /football, /boxing, /running, /news, /calendar)
- **Sports cards section renders** — sports card grid/section exists
- **Calendar section renders** — upcoming events section exists
- **News section renders** — news section exists
- **Donation CTA renders** — donate button/link exists, points to `/purchase/{donationPriceId}`
- **Footer renders** — footer with key links present

### 2. `membership.spec.ts` — Full Member Signup + Payment

Single golden-path test covering the entire flow:

1. Visit `/membership/join`
2. Fill join form (name, address, DOB, emergency contact, medical info)
3. Submit — redirected to `/auth/register` with pre-filled name/email
4. Complete registration (enter password)
5. Redirected to `/auth/registered`
6. Read verification email from filesystem, extract verification URL
7. Visit verification URL — email confirmed
8. Login at `/auth/login`
9. Redirected to `/members`
10. Verify members area shows empty membership state (no active membership)
11. Navigate to `/membership/pay`
12. Select membership type (e.g. Senior Player)
13. Select schedule (e.g. Annual)
14. Select payment method (Online)
15. Follow payment link to `/purchase/[priceId]`
16. Fill Stripe embedded checkout (test card `4242424242424242`, country, postcode)
17. Submit payment
18. Verify checkout session completed via Stripe API (`findRecentCheckoutSession()`)
19. Simulate webhook — `simulateCheckoutWebhook()` POSTs signed event to `/api/stripe_hook`
20. Return to `/members`
21. Verify membership tab shows active membership with correct type and paid-until date

### 3. `members-area.spec.ts` — Members Area Tabs

Uses `authenticatedPage` fixture (logged in, no membership).

- **Membership tab — empty state** — shows join/pay prompt, no active membership
- **Payments tab — empty state** — shows empty list or "no payments" message
- **Subscriptions tab — empty state** — shows empty list
- **Unauthenticated redirect** — visiting `/members` without auth redirects to `/auth/login`

### 4. `navigation.spec.ts` — Navigation & Content Pages

Structural tests only.

- **Sport pages load** — `/cricket`, `/football`, `/boxing`, `/running` return 200, have a heading
- **News listing loads** — `/news/1` renders with a list container
- **Calendar loads** — `/calendar` renders with calendar structure
- **Person listing loads** — `/person` renders
- **Privacy page loads** — `/legal/privacy` renders with content
- **404 handling** — non-existent route shows appropriate error page

### 5. `newsletter.spec.ts` — Event Subscriber Signup

- **Subscribe with valid email** — find signup form, enter email, submit, verify success
- **Subscribe with invalid email** — verify validation error
- **Duplicate subscription** — submit same email twice, verify appropriate handling

## Environment Changes

Add to `.env.test`:
```
STRIPE_WEBHOOK_SECRET=this-is-not-a-secret-value
```

## Decisions

- **No CMS content assertions** — all tests check structural presence, not specific text from Contentful.
- **Full Stripe interaction** — tests fill the actual Stripe embedded checkout iframe rather than stopping at the boundary.
- **Webhook simulation via signed POST** — after Stripe API verification, we POST a signed `checkout.session.completed` event to the local webhook endpoint. The signing secret in test is a known, non-secret value.
- **Single golden-path test for membership** — the full join-register-pay flow is one test rather than separate tests, since each step depends on the previous.
