# ADR 0001: Duffel as the inventory supplier, starting with flights

- **Status:** Accepted for flights (Phase 1). The hotel and car approach is still open; see "Open question".
- **Date:** 2026-11-14

## Context

All inventory in Andacity is seeded Postgres data behind the provider-adapter contract (`src/lib/providers/providerAdapter.ts`). The roadmap's Decision 0 sets the MVP as hybrid (real, bookable flights), with full booking for all three verticals from the public beta onward.

## Decision: Duffel

[Duffel](https://duffel.com) covers the whole path on one API, one contract and one test mode:

- **Flights:** 500+ airlines. *Managed Content* lets us sell without our own IATA/ARC accreditation.
- **Stays:** hotel search, quote and book (`/stays/...`).
- **Cars:** about 40 rental brands (`/cars/...`, launched 2026).

Published pricing (Nov 2026; confirm at signup): $3 per confirmed flight order, plus 1% of order value for Managed Content. Searches beyond a 1500:1 search-to-book ratio cost $0.005 each. Stays commission is shared with the seller.

We call the REST API directly (`src/lib/providers/duffel/duffelHttpClient.ts`) rather than through `@duffel/api`, which pulls in `node-fetch@2` and pinned Node types.

## Flight integration design

**Inventory IDs stay canonical.** Duffel offer IDs (`off_…`) are opaque and expire after about 30 minutes, so they can't serve as our inventory IDs. The existing ID shape `flight:{carrier}:{flightKey}:{departDate}:{origin}:{destination}` is kept. Its flight-number slot holds a key derived from the itinerary:

| Itinerary | Key |
|---|---|
| Nonstop | `BA112` |
| Connection | `AA100BA178` |
| Round trip | `AA100BA178R20261217BA213` |

`R{yyyymmdd}` carries the return date, which the canonical ID has no slot for. It can't collide with segment text, because IATA carrier codes always contain a letter and flight numbers are at most 4 digits. URLs, trip snapshots and revalidation need no schema change.

**Resolving re-searches.** `resolveInventory` and `fetchPrice` re-run the offer request for the route and dates, then pick the cheapest offer whose recomputed key matches. An itinerary that's no longer sold resolves to `null`, which the trip revalidation engine already reports as unavailable.

**One offer per itinerary.** Duffel returns one offer per fare brand. We keep the cheapest per key, up to 50 results.

**Prices are per traveller,** matching the seeded provider: `total_amount / passengers`. Re-checks price for one adult. Phase 2 checkout re-prices with the real passenger list before payment.

**Times are UTC instants.** Duffel segment times are local to each airport, with no offset. They're converted with the airport's `time_zone`, matching the seed's UTC instants.

**Caching.** Offer requests are cached in memory per route, dates and passenger count for 5 minutes (200 entries). A search followed by add-to-trip or a price check makes one Duffel call, which also protects the search-to-book ratio.

**Search scope.** Economy cabin, at most 1 connection, adult passengers only. A supplier timeout of 15 s inside a 25 s request timeout. The incremental search UI already handles slow providers.

**Failures stay inside the adapter.** Supplier errors are logged server-side with Duffel's request ID. Callers see the same coarse `FlightProviderClientError` codes as the seeded provider, and search degrades to no results.

**Selecting the source.** `ANDACITY_FLIGHT_PROVIDER=duffel` plus `DUFFEL_ACCESS_TOKEN` switches flight search and the `flight` provider alias to Duffel. Anything else keeps the seed. Only one flight source is active at a time, so seeded and live results never mix. Saved items whose `provider` is a display label (such as the airline name) now revalidate through the vertical's active provider. Before this, they fell through to the seeded database lookup.

**Booking is not enabled.** The `duffel` provider has no booking descriptor in `getProviderConfig`, so checkout refuses to book Duffel flights until Phase 2 adds order creation (`POST /air/orders`), payment and the confirmation path.

## Open question: hotels and cars in the MVP

Decision 0 planned affiliate hand-offs for hotels and cars in the MVP, with full booking from the beta. Duffel's Stays and Cars APIs change the trade-off:

- **A. Duffel search now, booking at the beta (recommended).** Real hotel and car inventory from Duffel in the MVP, with booking disabled until Phase 6. We don't build an affiliate integration that Phase 6 would throw away. The cost is that MVP trips hold hotel and car items you can price and save but not yet book.
- **B. Affiliate hand-offs, as planned.** Users can complete hotel and car bookings in the MVP, on a partner site. It needs a second supplier relationship (e.g. Booking.com/Expedia affiliate programmes, DiscoverCars) whose code is replaced in Phase 6.
- **C. Duffel booking for all three verticals in the MVP.** This is full booking early. Prepaid hotel and car sales bring the seller-of-travel and servicing obligations forward.

## Consequences

- No live calls happen until a Duffel test token is configured (`duffel_test_…`, from the Duffel dashboard in Developer test mode).
- Every resolve on a cold cache is a full offer request. Phase 2 should look at caching offer responses by key, or using `GET /air/offers/{id}` while the offer is still valid.
- Fare-brand choice (basic vs. main vs. flex) is collapsed to the cheapest option. Exposing brands needs the inventory ID to carry a brand token, along the lines of the hotel `variant` token.
