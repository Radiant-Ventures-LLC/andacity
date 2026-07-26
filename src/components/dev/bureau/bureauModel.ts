/**
 * CLAUDE-UI-051 — Bureau design-preview model.
 *
 * DEV / DESIGN-PREVIEW ONLY. Pure derivation over the real generated hotel
 * inventory (`~/data/hotels`) so the Bureau surfaces render actual names,
 * neighborhoods, ratings, policies, and nightly rates rather than mock copy.
 *
 * Pricing note: this preview multiplies `fromNightly` by the night count and
 * labels the result "N nights, from". It deliberately does NOT invent taxes or
 * property fees — the real all-in figure comes from the checkout pricing path
 * (src/lib/trips/trip-item-snapshot.ts), which a design sandbox has no business
 * approximating.
 */
import type { Hotel } from "~/data/hotels";

export type BureauStay = {
  /** 1-based position in the sorted list; Bureau numbers its rows. */
  index: number;
  slug: string;
  name: string;
  /** "Beachfront · resort" — the row's secondary line. */
  qualifier: string;
  neighborhood: string;
  /** Short policy attributes, already filtered to the ones that are true. */
  attributes: string[];
  rating: number;
  reviewCount: number;
  nightly: number;
  total: number;
  /** Lowest total in the set — the only place the signal red is spent. */
  isBest: boolean;
};

export type BureauFacet = {
  label: string;
  count: number;
};

export type BureauFacetGroup = {
  title: string;
  facets: BureauFacet[];
};

export type BureauTrip = {
  cityQuery: string;
  cityLabel: string;
  /** Display-only date range; the preview does not run availability. */
  dateLabel: string;
  travelers: number;
  nights: number;
};

export const BUREAU_TRIP: BureauTrip = {
  cityQuery: "miami",
  cityLabel: "Miami",
  dateLabel: "14–18 March",
  travelers: 2,
  nights: 4,
};

/** Policy flags that earn a place in the attribute column, in fixed order. */
const POLICY_ATTRIBUTES: ReadonlyArray<{
  key: "freeCancellation" | "noResortFees" | "payLater";
  label: string;
}> = [
  { key: "freeCancellation", label: "Refundable" },
  { key: "noResortFees", label: "No resort fee" },
  { key: "payLater", label: "Pay later" },
];

export const selectBureauHotels = (
  hotels: readonly Hotel[],
  cityQuery: string,
) => hotels.filter((hotel) => hotel.cityQuery === cityQuery);

const titleCase = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

/**
 * Sorts by total ascending — Bureau leads with the number, so the cheapest
 * stay is row 01 and carries the signal color. Ties keep inventory order,
 * which keeps the list stable across renders.
 */
export const buildBureauStays = (
  hotels: readonly Hotel[],
  nights: number,
): BureauStay[] => {
  const priced = hotels.map((hotel) => ({
    hotel,
    total: hotel.fromNightly * nights,
  }));

  const sorted = [...priced].sort((a, b) => a.total - b.total);
  const bestTotal = sorted.length ? sorted[0].total : 0;

  return sorted.map(({ hotel, total }, position) => ({
    index: position + 1,
    slug: hotel.slug,
    name: hotel.name,
    qualifier: [hotel.neighborhood, titleCase(hotel.propertyType || "")]
      .filter(Boolean)
      .join(" · "),
    neighborhood: hotel.neighborhood,
    attributes: POLICY_ATTRIBUTES.filter(({ key }) => hotel.policies[key]).map(
      ({ label }) => label,
    ),
    rating: hotel.rating,
    reviewCount: hotel.reviewCount,
    nightly: hotel.fromNightly,
    total,
    isBest: total === bestTotal,
  }));
};

/** Facet counts derived from the same set the rows come from — never hardcoded. */
export const buildBureauFacetGroups = (
  hotels: readonly Hotel[],
): BureauFacetGroup[] => {
  const byNeighborhood = new Map<string, number>();
  for (const hotel of hotels) {
    const key = hotel.neighborhood || "Unlisted";
    byNeighborhood.set(key, (byNeighborhood.get(key) || 0) + 1);
  }

  const areaFacets = [...byNeighborhood.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const policyFacets = POLICY_ATTRIBUTES.map(({ key, label }) => ({
    label,
    count: hotels.filter((hotel) => hotel.policies[key]).length,
  })).filter((facet) => facet.count > 0);

  const starFacets = [5, 4, 3]
    .map((stars) => ({
      label: `${stars} star`,
      count: hotels.filter((hotel) => hotel.stars === stars).length,
    }))
    .filter((facet) => facet.count > 0);

  return [
    { title: "Area", facets: areaFacets },
    { title: "Rating", facets: starFacets },
    { title: "Policy", facets: policyFacets },
  ].filter((group) => group.facets.length > 0);
};

export type BureauRoom = {
  id: string;
  name: string;
  beds: string;
  sleeps: number;
  sizeSqft: number;
  /**
   * `Room.priceFrom` in the generated inventory is a nightly rate, not a stay
   * total — it matches `Hotel.fromNightly` for the entry-level room. Named and
   * labelled as nightly so the surface never implies an all-in figure.
   */
  nightly: number;
  refundable: boolean;
  payLater: boolean;
};

export type BureauDetail = {
  slug: string;
  name: string;
  neighborhood: string;
  city: string;
  propertyType: string;
  stars: number;
  rating: number;
  reviewCount: number;
  summary: string;
  addressLine: string;
  nightly: number;
  total: number;
  amenities: string[];
  rooms: BureauRoom[];
  checkInTime: string;
  checkOutTime: string;
  cancellationBlurb: string;
  feesBlurb: string;
};

export const buildBureauDetail = (
  hotel: Hotel,
  nights: number,
): BureauDetail => ({
  slug: hotel.slug,
  name: hotel.name,
  neighborhood: hotel.neighborhood,
  city: hotel.city,
  propertyType: titleCase(hotel.propertyType || "Stay"),
  stars: hotel.stars,
  rating: hotel.rating,
  reviewCount: hotel.reviewCount,
  summary: hotel.summary,
  addressLine: hotel.addressLine,
  nightly: hotel.fromNightly,
  total: hotel.fromNightly * nights,
  amenities: hotel.amenities,
  rooms: (hotel.rooms || []).map((room) => ({
    id: room.id,
    name: room.name,
    beds: room.beds,
    sleeps: room.sleeps,
    sizeSqft: room.sizeSqft,
    nightly: room.priceFrom,
    refundable: room.refundable,
    payLater: room.payLater,
  })),
  checkInTime: hotel.policies.checkInTime,
  checkOutTime: hotel.policies.checkOutTime,
  cancellationBlurb: hotel.policies.cancellationBlurb,
  feesBlurb: hotel.policies.feesBlurb,
});

export const formatUsd = (value: number) =>
  `$${Math.round(value).toLocaleString("en-US")}`;

export const formatCount = (value: number) => value.toLocaleString("en-US");
