import assert from "node:assert/strict";
import test from "node:test";

import type { Hotel, HotelPolicy } from "../../../data/hotels.ts";

const bureauModelModule: typeof import("./bureauModel.ts") = await import(
  new URL("./bureauModel.ts", import.meta.url).href
);

const {
  buildBureauFacetGroups,
  buildBureauStays,
  formatCount,
  formatUsd,
  selectBureauHotels,
} = bureauModelModule;

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
  amenities: ["Pool"],
  policies: policies(),
  rooms: [],
  faq: [],
  ...overrides,
});

test("selectBureauHotels keeps only the requested city", () => {
  const hotels = [
    hotel({ slug: "a", cityQuery: "miami" }),
    hotel({ slug: "b", cityQuery: "new-york" }),
  ];

  assert.deepEqual(
    selectBureauHotels(hotels, "miami").map((h) => h.slug),
    ["a"],
  );
});

test("buildBureauStays sorts by total and numbers rows from one", () => {
  const stays = buildBureauStays(
    [
      hotel({ slug: "pricey", fromNightly: 300 }),
      hotel({ slug: "cheap", fromNightly: 100 }),
      hotel({ slug: "middle", fromNightly: 200 }),
    ],
    4,
  );

  assert.deepEqual(
    stays.map((s) => [s.index, s.slug, s.total]),
    [
      [1, "cheap", 400],
      [2, "middle", 800],
      [3, "pricey", 1200],
    ],
  );
});

test("buildBureauStays marks only the lowest total as best", () => {
  const stays = buildBureauStays(
    [
      hotel({ slug: "a", fromNightly: 100 }),
      hotel({ slug: "b", fromNightly: 150 }),
    ],
    2,
  );

  assert.deepEqual(
    stays.map((s) => s.isBest),
    [true, false],
  );
});

test("buildBureauStays marks every stay tied at the lowest total", () => {
  // Deliberate: the signal color marks the best price, not a single winner.
  const stays = buildBureauStays(
    [
      hotel({ slug: "a", fromNightly: 100 }),
      hotel({ slug: "b", fromNightly: 100 }),
      hotel({ slug: "c", fromNightly: 120 }),
    ],
    1,
  );

  assert.deepEqual(
    stays.map((s) => s.isBest),
    [true, true, false],
  );
});

test("buildBureauStays lists only policies that are true, in fixed order", () => {
  const [stay] = buildBureauStays(
    [hotel({ policies: policies({ payLater: true, freeCancellation: true }) })],
    1,
  );

  assert.deepEqual(stay.attributes, ["Refundable", "Pay later"]);
});

test("buildBureauStays leaves attributes empty when no policy applies", () => {
  const [stay] = buildBureauStays([hotel({ policies: policies() })], 1);

  assert.deepEqual(stay.attributes, []);
});

test("buildBureauStays composes the qualifier from area and property type", () => {
  const [stay] = buildBureauStays(
    [hotel({ neighborhood: "Marina", propertyType: "resort" })],
    1,
  );

  assert.equal(stay.qualifier, "Marina · Resort");
});

test("buildBureauFacetGroups counts areas from the same set the rows come from", () => {
  const groups = buildBureauFacetGroups([
    hotel({ slug: "a", neighborhood: "Beachfront" }),
    hotel({ slug: "b", neighborhood: "Beachfront" }),
    hotel({ slug: "c", neighborhood: "Marina" }),
  ]);

  const area = groups.find((g) => g.title === "Area");
  assert.deepEqual(area?.facets, [
    { label: "Beachfront", count: 2 },
    { label: "Marina", count: 1 },
  ]);
});

test("buildBureauFacetGroups drops groups that would render empty", () => {
  const groups = buildBureauFacetGroups([hotel({ policies: policies() })]);

  assert.equal(
    groups.some((g) => g.title === "Policy"),
    false,
  );
});

test("buildBureauFacetGroups counts each policy independently", () => {
  const groups = buildBureauFacetGroups([
    hotel({ slug: "a", policies: policies({ freeCancellation: true }) }),
    hotel({
      slug: "b",
      policies: policies({ freeCancellation: true, noResortFees: true }),
    }),
  ]);

  const policy = groups.find((g) => g.title === "Policy");
  assert.deepEqual(policy?.facets, [
    { label: "Refundable", count: 2 },
    { label: "No resort fee", count: 1 },
  ]);
});

test("formatUsd rounds and groups thousands", () => {
  assert.equal(formatUsd(1004.4), "$1,004");
  assert.equal(formatUsd(999.5), "$1,000");
});

test("formatCount groups thousands", () => {
  assert.equal(formatCount(17004), "17,004");
});
