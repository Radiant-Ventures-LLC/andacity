import assert from "node:assert/strict";
import test from "node:test";

import type { Hotel, HotelPolicy } from "../../../data/hotels.ts";

const ledgerModelModule: typeof import("./ledgerModel.ts") = await import(
  new URL("./ledgerModel.ts", import.meta.url).href
);
const priceDisplayModule: typeof import("../../../lib/pricing/price-display.ts") =
  await import(
    new URL("../../../lib/pricing/price-display.ts", import.meta.url).href
  );

const {
  buildLedgerRollup,
  buildLedgerStayRows,
  segmentSharePercent,
  sortLedgerRows,
  togglePinned,
} = ledgerModelModule;
const { HOTEL_ESTIMATED_TAX_RATE } = priceDisplayModule;

const policies = (overrides: Partial<HotelPolicy> = {}): HotelPolicy => ({
  freeCancellation: false,
  payLater: false,
  noResortFees: false,
  checkInTime: "3:00 PM",
  checkOutTime: "10:00 AM",
  cancellationBlurb: "cancellation",
  paymentBlurb: "payment",
  feesBlurb: "fees",
  ...overrides,
});

const hotel = (overrides: Partial<Hotel> = {}): Hotel => ({
  slug: "miami-hotel-01",
  name: "Harborline Suites",
  city: "Miami",
  region: "Florida",
  country: "United States",
  cityQuery: "miami",
  neighborhood: "Beachfront",
  propertyType: "hotel",
  addressLine: "1 Ocean Drive",
  currency: "USD",
  stars: 4,
  rating: 4.4,
  reviewCount: 1200,
  fromNightly: 200,
  summary: "summary",
  images: [],
  amenities: [],
  policies: policies(),
  rooms: [],
  faq: [],
  ...overrides,
});

const rollupInput = () => ({
  flight: {
    airline: "JetBlue",
    origin: "SFO",
    destination: "MIA",
    stopsLabel: "Nonstop",
    price: 800,
    currency: "USD",
  },
  stay: { name: "Harborline Suites", nightly: 200, currency: "USD" },
  car: {
    name: "OpenRoad",
    pickupArea: "MIA Airport",
    fromDaily: 50,
    currency: "USD",
  },
  nights: 4,
  carDays: 4,
  travelers: 2,
});

test("buildLedgerStayRows takes its fee figures from the production contract", () => {
  const { rows } = buildLedgerStayRows([hotel({ fromNightly: 200 })], {
    nights: 4,
  });

  // 200 * 4 = 800 base; fees are the domain's rate, not a number chosen here.
  assert.equal(rows[0].baseTotal, 800);
  assert.equal(rows[0].fees, Math.round(800 * HOTEL_ESTIMATED_TAX_RATE));
  assert.equal(rows[0].total, rows[0].baseTotal + rows[0].fees);
});

test("buildLedgerStayRows exposes the all-in nightly rate", () => {
  const { rows } = buildLedgerStayRows([hotel({ fromNightly: 200 })], {
    nights: 4,
  });

  assert.equal(rows[0].allInNightly, Math.round(rows[0].total / 4));
  // The headline rate understates the real per-night cost, which is the point.
  assert.ok(rows[0].allInNightly > rows[0].nightly);
});

test("buildLedgerStayRows sorts by estimated total and flags the cheapest", () => {
  const { rows } = buildLedgerStayRows(
    [
      hotel({ slug: "high", fromNightly: 300 }),
      hotel({ slug: "low", fromNightly: 100 }),
      hotel({ slug: "mid", fromNightly: 200 }),
    ],
    { nights: 2 },
  );

  assert.deepEqual(
    rows.map((r) => r.slug),
    ["low", "mid", "high"],
  );
  assert.deepEqual(
    rows.map((r) => r.isBest),
    [true, false, false],
  );
});

test("buildLedgerStayRows carries the contract's own disclosure text", () => {
  const { supportText } = buildLedgerStayRows([hotel()], { nights: 2 });

  assert.equal(
    supportText,
    "Taxes and fees are estimated from current policy data.",
  );
});

test("buildLedgerStayRows handles an empty result set", () => {
  const set = buildLedgerStayRows([], { nights: 4 });

  assert.deepEqual(set.rows, []);
  assert.equal(set.supportText, null);
});

test("sortLedgerRows lifts pinned rows in the order they were pinned", () => {
  const { rows } = buildLedgerStayRows(
    [
      hotel({ slug: "a", fromNightly: 100 }),
      hotel({ slug: "b", fromNightly: 200 }),
      hotel({ slug: "c", fromNightly: 300 }),
    ],
    { nights: 1 },
  );

  assert.deepEqual(
    sortLedgerRows(rows, ["c", "b"]).map((r) => r.slug),
    ["c", "b", "a"],
  );
});

test("sortLedgerRows keeps the price order when nothing is pinned", () => {
  const { rows } = buildLedgerStayRows(
    [
      hotel({ slug: "a", fromNightly: 100 }),
      hotel({ slug: "b", fromNightly: 200 }),
    ],
    { nights: 1 },
  );

  assert.deepEqual(
    sortLedgerRows(rows, []).map((r) => r.slug),
    ["a", "b"],
  );
});

test("sortLedgerRows ignores pins that match no row", () => {
  const { rows } = buildLedgerStayRows([hotel({ slug: "a" })], { nights: 1 });

  assert.deepEqual(
    sortLedgerRows(rows, ["ghost"]).map((r) => r.slug),
    ["a"],
  );
});

test("togglePinned adds and removes without mutating the input", () => {
  const initial: string[] = [];
  const added = togglePinned(initial, "a");
  const removed = togglePinned(added, "a");

  assert.deepEqual(added, ["a"]);
  assert.deepEqual(removed, []);
  assert.deepEqual(initial, []);
});

test("buildLedgerRollup models hotel fees and leaves flight and car fees null", () => {
  const rollup = buildLedgerRollup(rollupInput());

  const byKey = Object.fromEntries(rollup.segments.map((s) => [s.key, s]));
  assert.equal(byKey.flight.fees, null);
  assert.equal(byKey.car.fees, null);
  assert.equal(byKey.stay.fees, Math.round(800 * HOTEL_ESTIMATED_TAX_RATE));
});

test("buildLedgerRollup names the segments that make the total incomplete", () => {
  const rollup = buildLedgerRollup(rollupInput());

  assert.deepEqual(rollup.unmodeledFeeSegments, ["Flight", "Car"]);
});

test("buildLedgerRollup totals base plus only the fees that are modeled", () => {
  const rollup = buildLedgerRollup(rollupInput());

  // flight 800 * 2 travelers + stay 800 + car 50 * 4 days
  assert.equal(rollup.base, 1600 + 800 + 200);
  assert.equal(rollup.modeledFees, Math.round(800 * HOTEL_ESTIMATED_TAX_RATE));
  assert.equal(rollup.total, rollup.base + rollup.modeledFees);
  assert.equal(rollup.perTraveler, Math.round(rollup.total / 2));
});

test("buildLedgerRollup multiplies the fare by travelers", () => {
  const single = buildLedgerRollup({ ...rollupInput(), travelers: 1 });
  const double = buildLedgerRollup(rollupInput());

  const fareOf = (r: ReturnType<typeof buildLedgerRollup>) =>
    r.segments.find((s) => s.key === "flight")?.base;

  assert.equal(fareOf(single), 800);
  assert.equal(fareOf(double), 1600);
});

test("segmentSharePercent returns zero rather than dividing by zero", () => {
  const [segment] = buildLedgerRollup(rollupInput()).segments;

  assert.equal(segmentSharePercent(segment, 0), 0);
  assert.ok(segmentSharePercent(segment, 100) > 0);
});
