# ADR 0002: Retire synthetic inventory as suppliers replace it

- **Status:** Accepted 2026-11-14. Flights retired on dev the same day; hotels and cars follow their Duffel adapters.
- **Date:** 2026-11-14
- **Related:** [ADR 0001](0001-duffel-flight-inventory.md) (Duffel as supplier), [Roadmap](../ROADMAP.md) Phases 1 and 4.

## Context

Until Phase 1, every Andacity result came from a generated seed: a rolling 120-day horizon of synthetic flights, hotels and cars in Postgres. On dev, flight inventory alone was about 12.5 GB (13M itineraries, 26M fares, 13M segments), and a full reseed took about an hour.

ADR 0001 switched flights on dev to Duffel. From then on:

- **The flight rows were dead weight.** Nothing a user sees in search, flight pages or trip revalidation reads them while Duffel is active.
- **They were still a hazard.** Fake inventory that can reach a production deployment by misconfiguration could be shown, and from Phase 2 sold, to real users.
- **Trip suggestions still read them.** The trip bundling suggestions query the seeded flight tables directly, so they could offer seeded flights next to live Duffel ones.

## Decisions

### 1. Reference data stays; synthetic inventory goes

| Kind | Tables | Fate |
|---|---|---|
| Reference data | `countries`, `regions`, `cities`, `airports` | **Kept** and always seeded. Real-world places that live inventory needs. For example, saving a Duffel flight to a trip looks up the destination city (`findCityByAirportCode`). |
| Synthetic flights | `airlines`, `flight_routes`, `flight_itineraries`, `flight_segments`, `flight_fares` | **Retired** while Duffel serves flights. |
| Synthetic hotels | `hotel_*`, `hotels` | Retired once the Duffel Stays adapter is verified on dev. |
| Synthetic cars | `car_*` | Retired once the Duffel Cars adapter is verified on dev. |

### 2. One vertical at a time, only after its supplier is verified

A vertical's seed rows are deleted only after its supplier adapter is live on dev and has passed the Phase 1 exit test: search, save to a trip, revalidate. Until then the seed keeps the vertical usable in the demo.

### 3. The seed code stays, for tests and offline work

The seeded provider adapters and the generator are kept:

- **Tests and CI** run against the seeded provider and need no Duffel token or network.
- **Local development** works without a supplier token. `pnpm db:seed:local` seeds a 14-day horizon, a fraction of the 120-day dev horizon.

### 4. Production fails closed on seeded inventory

`src/lib/providers/inventorySources.ts` reports each vertical's active source. In a production build (`NODE_ENV=production`), every request gets **HTTP 503** while any vertical is served from the seed. The one exception is a deployment that sets `ANDACITY_ALLOW_SEED_INVENTORY=true`. The server logs which verticals are blocked.

- **dev.andacity.com** sets the flag in `deploy/dev/docker-compose.yml`. It's a private demo behind Cloudflare Access, and hotels and cars are still seeded there.
- **Production must not set it.** `scripts/check-production-env.sh` fails if the flag is set, or if `ANDACITY_FLIGHT_PROVIDER` isn't `duffel`.
- **Consequence:** production can't serve traffic until all three verticals have a supplier. That is intended. The public beta's inventory is real or absent.

### 5. The seed skips verticals a supplier serves

`scripts/seed/postgres-seed.mjs --vertical all` skips flights when `ANDACITY_FLIGHT_PROVIDER=duffel`. With `--reset`, it also leaves the flight tables alone. A dev reseed (`redeploy.sh --seed`) therefore doesn't recreate the 12.5 GB. Naming the vertical (`--vertical flights`) still seeds it, for local work.

### 6. Retiring a vertical on dev (procedure)

1. Confirm no trip item references the vertical's seeded rows. The `trip_items` foreign keys are `ON DELETE RESTRICT`, so step 3 would fail rather than orphan or delete trip items.
2. Back up everything except the rows being retired: `pg_dump -Fc --exclude-table-data=<vertical tables>`. The retired rows themselves are regenerable from the deterministic seed.
3. Delete the rows in dependency order, using `TRUNCATE` for leaf tables and `DELETE` where other tables reference them. Avoid `TRUNCATE … CASCADE`.
4. Run `VACUUM FULL` on the emptied tables to return disk space.
5. Redeploy, then run the vertical's smoke check again.

## Consequences

- **Trip suggestions:** suggestions such as "add a return flight" no longer find seeded flights on dev. They need rebuilding on the active provider, preferably as links into a prefilled search rather than a supplier call on every trip view. Logged in the roadmap.
- **Seed reset wipes trips (existing hazard, not new):** `--reset` uses `TRUNCATE … CASCADE` on the seed tables. Postgres cascades that into every referencing table, including `trip_items` and anything under it. Any `--reset` reseed on dev wipes saved trips. Before the beta, this must be fixed so reseeding never touches user data, or the seed must be kept out of production entirely (Phase 4).
- **Trips saved against seeded inventory** come back unavailable on their next re-check, as ADR 0001 already noted for flights.
- **Restoring the seed on dev:** run `pnpm db:seed:flights` through the tools service, with `ANDACITY_FLIGHT_PROVIDER` set back to `seed`.

## Record: flights retired on dev (2026-11-14)

| Step | Result |
|---|---|
| Trip items referencing seeded flights | None (checked inside the deleting transaction). |
| Backup | `/opt/andacity/backups/pre-flight-retire-20261115T051352Z.dump` on `andacity-dev` (mode 600; all tables, flight rows excluded; 36 tables of data incl. `trips`, `trip_items`, `cities`). |
| Deleted | 26.5M fares and 13.2M segments (truncate), 13,243,200 itineraries (4 min 15 s), 10,800 routes, 30 airlines. |
| Database size | 12 GB → 19 MB after `VACUUM FULL`. |
| Guard | Dev serves normally with the flag set. The same image without it returned 503 on `/`, `/flights` and `/healthz`, and logged the blocked verticals (hotel, car). |
| Smoke check | Duffel flight search JFK→LHR returns results. Trips 3 and 4 (Duffel flights) revalidate: `valid` and `price_only_changed`. Hotels page 200. |
