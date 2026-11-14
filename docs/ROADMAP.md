# Andacity Roadmap to MVP

_Last updated: 2026-11-14_

## Where we are

**Product.** Andacity is a Qwik/QwikCity + Postgres (Drizzle) app that puts flights, hotels and car rentals together into one trip. The full loop exists end to end: discovery (explore, destinations), canonical search for all three verticals, entity pages, compare, trip assembly with persisted snapshots and revalidation, checkout, a booking-run engine, Stripe PaymentIntent adapters, confirmation and itinerary pages, anonymous itinerary ownership with claim tokens, saved travelers, and a Resend notification adapter.

**Inventory is synthetic.** Every "provider" adapter is a client over seeded Postgres tables. The 120-day seed holds about 40M flight rows. No real supplier is connected, so no booking reaches the outside world.

**UI.** A 51-task redesign (CLAUDE-UI-001 through 051) is done. The latest work is the Baseline palette and the Ledger comparison surface.

**Environments.** dev.andacity.com runs on an OCI VM behind Cloudflare Access as a private demo. The earlier AWS beta work (UI-045 to 050) stopped at external gates, and that infrastructure is now gone. andacity.com has no production deployment.

**Repo health.**
- `main` is still at v0.6.0 (2026-03-17). `dev` is 101 commits ahead and `feat/baseline-ledger` is 107 ahead. Nothing from the redesign has been released.
- `pnpm test` ran 280 tests: 277 passed and 3 failed. All three are search error-sanitization tests: a raw `"provider timeout"` message leaks where the safe message `"Search execution failed. Please try again."` is expected.
- Known debt from v0.6.0: legacy live search routes still sit alongside the canonical parser/page helpers.
- `AGENTS.md` points DB work at a dead RDS `DATABASE_URL`.
- `docs/ui-redesign/` holds about 20 audit and launch-gate reports that describe infrastructure that no longer exists.

## What MVP means

> **A traveler who has never heard of Andacity can go to andacity.com, plan a trip that combines flights, hotels and cars, pay once (or hand off cleanly), get a real confirmation by email, and come back later to view or manage the trip. The site has to be safe to leave running with real money and real people on it.**

In practice, MVP has to include:

1. **Real inventory in at least one vertical, with honest handling of the rest.** A product that sells seeded fake flights is a demo. This is the biggest gap.
2. **A complete transaction path:** price revalidation, payment (Stripe live mode), booking with the supplier, idempotent retries, failure and refund handling, and a confirmation email.
3. **Return access:** a magic-link account (or an emailed claim link) so a trip can be found again from another device.
4. **Trust basics:** reviewed terms and privacy pages, a working support contact, a clear cancellation policy per item, and accessible checkout.
5. **Production operations:** a production host for andacity.com, backups, error monitoring and alerting, abuse protection on search and checkout, and an end-to-end booking smoke test in CI.

**Outside MVP:** loyalty and rewards, multi-currency and localization, packages and bundled pricing, native apps, AI trip planning, price alerts, group bookings, and a partner or affiliate dashboard.

## Decision 0: what kind of MVP (decided 2026-11-13)

**Decision: hybrid MVP, then full booking from the public beta onward.**

- **MVP (hybrid):** real transactional booking for **flights** through an aggregator that handles ticketing (e.g. Duffel). Hotels and cars use real inventory through affiliate/handoff APIs. The trip itinerary still brings all three together.
- **Public beta and later (full booking):** hotels and cars become transactional as well, so the whole trip is booked and paid on Andacity. See Phase 6.

Options considered:

| Option | What it means | Outcome |
|---|---|---|
| A. Transactional (merchant) | Every vertical is booked and paid on Andacity. | **Target for the public beta** (Phase 6) |
| B. Hybrid | Flights are transactional; hotels and cars hand off. | **Chosen for MVP** |
| C. Portfolio demo | Synthetic inventory, Stripe in test mode. | Rejected |

**What this means for the design:** the hybrid MVP must not paint us into a corner.
- A hotel or car handoff adapter is a temporary implementation of the same provider and booking adapter contracts. It must not be a separate code path.
- Checkout, booking runs and payments must assume a trip can hold several transactional items from several suppliers. Do not hard-code "only flights charge."
- Seller-of-travel registration, merchant-of-record terms and servicing obligations go on the critical path for Phase 6. Start the legal and registration work during the MVP phases, because it takes weeks.

The provider-adapter and booking-adapter interfaces were built for this kind of swap. A new supplier should plug in as another adapter beside the seeded one.

## Phases

### Phase 0: Consolidate and release what exists (≈1 week)

Goal: one trunk, green CI, an honest baseline.

- [x] Fix the 3 failing search error-sanitization tests (`b18fb1d`; raw API errors are now exposed only in development).
- [x] Merge `feat/baseline-ledger` → `dev` → `main` and tag **0.7.0**, with CHANGELOG, RELEASENOTES and README updated (2026-11-14).
- [x] CI on every PR and on pushes to `main` and `dev`: `pnpm test`, `lint`, `build.types` and `build`. The dead EC2 deploy workflows are removed.
- [x] Triage the dependency vulnerabilities (`pnpm audit`: 129 → 3, no critical left). Remaining, accepted for now:
  - `zod` 3.25.48 (high): pinned by `@builder.io/qwik-city`; no patched 3.x exists. The app doesn't use `zod`. Revisit when Qwik City moves to zod 4.
  - `minimatch` 7–10 (moderate): lint toolchain only; fixed by a typescript-eslint upgrade.
  - `esbuild` ≤0.24.2 (moderate): `drizzle-kit`'s dev-time loader only.
- [ ] Bump the GitHub Actions versions off Node 20 before the runners drop it.
- [x] Finish the canonical search-route consolidation. The legacy `/search/*` and `/cars/search/*` routes were already thin redirects to canonical routes; the unreachable legacy search stack (old query modules, mappers, results/filter/compare components, ~4.4k lines) is deleted.
- [ ] Dead-code pass on the rest of the files no route reaches (explore intent mappers, email components, small booking/ownership predicates). Decide whether each one is wired up later or deleted.
- [x] Delete the stale `CLAUDE-UI-051-baseline-ledger.patch`.
- [x] Move the obsolete AWS launch-gate reports to `docs/archive/aws-public-beta/`.
- [x] Fix the `AGENTS.md` database guidance so it matches the current environment, and point `package.json` repo URLs at `Radiant-Ventures-LLC/andacity`.
- [ ] Prune merged or abandoned `feature/new-ui-ux--*` branches.

**Exit:** `main` = v0.7.0, CI green, dev.andacity.com deployed from `main`. ✅ Met 2026-11-14: 0.7.1 is deployed from `main`, and live search and the search API were smoke-tested.

### Phase 1: Real inventory (≈3–5 weeks)

- [ ] Choose suppliers and get sandbox credentials: flights (aggregator) and hotels and cars (affiliate or API).
- [ ] Build `flight` provider adapter #2 against the supplier sandbox: search, resolve inventory and price, using the existing adapter contract.
- [ ] Map supplier IDs into the canonical inventory ID scheme. Add search caching with TTLs that respect the supplier's rate limits.
- [ ] Hotels and cars: build handoff adapters (deep link + tracking) behind the standard adapter contract, and keep saving a snapshot to the trip. Prefer suppliers that also offer a transactional API, so Phase 6 is a mode switch rather than a supplier migration.
- [ ] Use a feature flag or env setting to pick the provider (seeded vs. live) per vertical, so dev can stay on seed data.
- [ ] Label any inventory that is not live booking in the UI ("Book on partner site").

**Exit:** a search on dev returns real sandbox offers, and adding one to a trip and revalidating it works.

### Phase 2: Transaction completeness (≈3–4 weeks)

- [ ] End-to-end checkout in Stripe test mode: PaymentIntent → supplier booking → capture, or cancel the PaymentIntent if the booking fails.
- [ ] Stripe webhooks (signed) and an idempotency key on every booking execution.
- [ ] Handle partial failure in multi-item trips: what gets charged, refunded, or flagged for manual review.
- [ ] Cancellation and refund flow for at least the transactional vertical.
- [ ] Confirmation and itinerary emails through Resend, plus failure and alert emails to ops.
- [ ] Collect the traveler details each supplier needs (passport and DOB fields for flights, as required).

**Exit:** a scripted E2E test books a sandbox flight and gets a confirmation email, and a forced supplier failure triggers an automatic refund.

### Phase 3: Accounts and trust (≈2 weeks)

- [ ] Magic-link sign-in. Claim anonymous itineraries into an account (the ownership domain already supports claim tokens).
- [ ] Make "My Trips" account-backed, with cross-device access.
- [ ] Legal review of terms and privacy. Show cancellation and refund policy per item at checkout.
- [ ] Support contact (a shared inbox is fine) and a booking lookup by reference plus email.
- [ ] Accessibility pass on search, checkout and confirmation (WCAG 2.1 AA).

### Phase 4: Production readiness (≈2 weeks)

- [ ] Production environment for andacity.com: a managed or backed-up Postgres with point-in-time recovery, secrets management, and deploys from `main`.
- [ ] A small production data footprint: a real supplier only needs reference data (airports, cities, locations), not the 40M-row seed.
- [ ] Error monitoring and alerting (the UI-033 integration exists; point it at production), plus uptime checks.
- [ ] Rate limiting, plus Turnstile on search bursts and checkout.
- [ ] Performance budget (Core Web Vitals) on home, search results and checkout.
- [ ] Runbook covering deploy, rollback, reseed/restore, and supplier outage.

### Phase 5: MVP pilot and launch (hybrid)

- [ ] Private pilot with 10–30 invited users on live mode, with low booking limits.
- [ ] Funnel analytics: search → add to trip → checkout → booked / handed off (the telemetry taxonomy is in `docs/booking-telemetry-taxonomy.md`).
- [ ] Fix pilot findings and tag **v0.10.0 (MVP)**.

### Phase 6: Full booking → public beta

The beta product, and every release after it, has full booking: every item in a trip is booked and paid on Andacity.

- [ ] Seller-of-travel registration (CA, FL, WA, HI as applicable) and merchant-of-record terms with each supplier. Start this during Phases 1–3.
- [ ] Transactional hotel adapter: book, retrieve and cancel, with rate-plan cancellation policies.
- [ ] Transactional car adapter: book, retrieve and cancel, with driver details.
- [ ] One payment for multi-supplier trips: authorize the total, capture each item as it confirms, and refund automatically when an item fails.
- [ ] Servicing: cancellations and changes for each vertical, supplier schedule-change handling, and an ops view of bookings that need manual review.
- [ ] Chargeback and fraud handling (Stripe Radar rules and a dispute playbook).
- [ ] Remove the handoff adapters from the beta product. Keep them only as a fallback if a supplier has an outage.
- [ ] Open the public beta and tag **v1.0.0-beta**.

## How we work

- Keep the `CLAUDE-UI-NNN` cadence (one task, one commit), but start new numbering for product work: `MVP-NNN`, grouped by phase.
- Every task ends with working code and tests. Write fewer audit and report docs: one short note per phase exit instead of one per task.
- Release from `main` at the end of each phase: v0.7 after Phase 0, v0.8 after inventory, v0.9 after transactions, v0.10 at the MVP (hybrid), and v1.0.0-beta at the public beta (full booking).
