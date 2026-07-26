/**
 * CLAUDE-UI-052 — Ledger design-preview model.
 *
 * DEV / DESIGN-PREVIEW ONLY. Ledger's argument is that the arithmetic should be
 * on screen, so this module computes nothing itself: every figure comes from
 * `~/lib/pricing/price-display`, the same contract the production surfaces use.
 *
 * What that contract does and does not model matters to the design:
 *   - `buildHotelPriceDisplay` applies HOTEL_ESTIMATED_TAX_RATE and returns
 *     base -> estimated fees -> estimated total.
 *   - `buildFlightPriceDisplay` and `buildCarPriceDisplay` return
 *     `estimatedFeesAmount: null` — flight and car fees are genuinely not
 *     modeled anywhere in the domain today.
 *
 * Ledger therefore reports an incomplete trip total and names the segments that
 * make it incomplete, rather than inventing the missing numbers. Surfacing that
 * gap is the direction working, not a shortcoming of the preview.
 */
import type { Hotel } from "~/data/hotels";
import {
  buildCarPriceDisplay,
  buildFlightPriceDisplay,
  buildHotelPriceDisplay,
  DEFAULT_CURRENCY_CODE,
} from "~/lib/pricing/price-display";

export type LedgerStayRow = {
  slug: string;
  name: string;
  area: string;
  nightly: number;
  baseTotal: number;
  /** Estimated taxes and fees from the hotel price contract. */
  fees: number;
  total: number;
  /** total / nights — what the stay actually costs per night once fees land. */
  allInNightly: number;
  refundable: boolean;
  noResortFees: boolean;
  /** Lowest estimated total in the set. */
  isBest: boolean;
  currencyCode: string;
};

export type LedgerStaySet = {
  rows: LedgerStayRow[];
  /** The contract's own disclosure text, shown rather than paraphrased. */
  supportText: string | null;
  nights: number;
};

export const buildLedgerStayRows = (
  hotels: readonly Hotel[],
  options: { nights: number; rooms?: number },
): LedgerStaySet => {
  const nights = options.nights;
  const rooms = options.rooms || 1;

  // Every hotel goes through the production contract; nothing is computed here.
  const displays = hotels.map((hotel) => ({
    hotel,
    display: buildHotelPriceDisplay({
      currencyCode: hotel.currency,
      nightlyRate: hotel.fromNightly,
      nights,
      rooms,
    }),
  }));

  const priced: LedgerStayRow[] = displays.map(({ hotel, display }) => {
    const baseTotal = display.baseTotalAmount ?? 0;
    const total = display.totalAmount ?? baseTotal;

    return {
      slug: hotel.slug,
      name: hotel.name,
      area: hotel.neighborhood,
      nightly: display.baseAmount ?? hotel.fromNightly,
      baseTotal,
      fees: display.estimatedFeesAmount ?? 0,
      total,
      allInNightly: nights > 0 ? Math.round(total / nights) : total,
      refundable: hotel.policies.freeCancellation,
      noResortFees: hotel.policies.noResortFees,
      isBest: false,
      currencyCode: display.currencyCode ?? DEFAULT_CURRENCY_CODE,
    };
  });

  const sorted = priced.sort((a, b) => a.total - b.total);
  const bestTotal = sorted.length ? sorted[0].total : 0;

  return {
    nights,
    supportText: displays.length
      ? (displays[0].display.supportText ?? null)
      : null,
    rows: sorted.map((row) => ({ ...row, isBest: row.total === bestTotal })),
  };
};

/**
 * Pinned rows lift to the top in the order they were pinned; everything else
 * keeps the price sort. Comparison only works if the things being compared stay
 * adjacent, which is the entire reason pinning exists in this direction.
 */
export const sortLedgerRows = (
  rows: readonly LedgerStayRow[],
  pinnedSlugs: readonly string[],
): LedgerStayRow[] => {
  const pinnedOrder = new Map(pinnedSlugs.map((slug, index) => [slug, index]));

  const pinned = rows
    .filter((row) => pinnedOrder.has(row.slug))
    .sort(
      (a, b) => (pinnedOrder.get(a.slug) ?? 0) - (pinnedOrder.get(b.slug) ?? 0),
    );
  const rest = rows.filter((row) => !pinnedOrder.has(row.slug));

  return [...pinned, ...rest];
};

export const togglePinned = (
  pinnedSlugs: readonly string[],
  slug: string,
): string[] =>
  pinnedSlugs.includes(slug)
    ? pinnedSlugs.filter((pinned) => pinned !== slug)
    : [...pinnedSlugs, slug];

export type LedgerSegment = {
  key: "flight" | "stay" | "car";
  label: string;
  detail: string;
  base: number;
  /** null when the domain does not model fees for this vertical. */
  fees: number | null;
  total: number;
};

export type LedgerRollup = {
  segments: LedgerSegment[];
  base: number;
  /** Only the fees the domain actually models — today, hotels alone. */
  modeledFees: number;
  total: number;
  perTraveler: number;
  /** Labels of segments whose fees are unknown, for the disclosure line. */
  unmodeledFeeSegments: string[];
  currencyCode: string;
};

export type LedgerRollupInput = {
  flight: {
    airline: string;
    origin: string;
    destination: string;
    stopsLabel: string;
    price: number;
    currency?: string;
    /** Included in the detail line so the fare's cabin is never implied. */
    cabinClass?: string;
    /** The seed generator quotes round trips by default; say which it was. */
    itineraryLabel?: string;
  };
  stay: { name: string; nightly: number; currency?: string };
  car: {
    name: string;
    pickupArea: string;
    fromDaily: number;
    currency?: string;
  };
  nights: number;
  carDays: number;
  travelers: number;
};

export const buildLedgerRollup = (input: LedgerRollupInput): LedgerRollup => {
  const flightDisplay = buildFlightPriceDisplay({
    currencyCode: input.flight.currency,
    fare: input.flight.price,
    travelers: input.travelers,
  });
  const stayDisplay = buildHotelPriceDisplay({
    currencyCode: input.stay.currency,
    nightlyRate: input.stay.nightly,
    nights: input.nights,
  });
  const carDisplay = buildCarPriceDisplay({
    currencyCode: input.car.currency,
    dailyRate: input.car.fromDaily,
    days: input.carDays,
  });

  const draft: Array<Omit<LedgerSegment, "total">> = [
    {
      key: "flight",
      label: "Flight",
      detail: [
        input.flight.airline,
        `${input.flight.origin} → ${input.flight.destination}`,
        input.flight.stopsLabel,
        [input.flight.cabinClass, input.flight.itineraryLabel]
          .filter(Boolean)
          .join(" "),
        `${input.travelers} travelers`,
      ]
        .filter(Boolean)
        .join(" · "),
      base: flightDisplay.baseTotalAmount ?? flightDisplay.baseAmount ?? 0,
      fees: flightDisplay.estimatedFeesAmount ?? null,
    },
    {
      key: "stay",
      label: "Stay",
      detail: `${input.stay.name} · ${input.nights} nights`,
      base: stayDisplay.baseTotalAmount ?? 0,
      fees: stayDisplay.estimatedFeesAmount ?? null,
    },
    {
      key: "car",
      label: "Car",
      detail: `${input.car.name} · ${input.car.pickupArea} · ${input.carDays} days`,
      base: carDisplay.baseTotalAmount ?? carDisplay.baseAmount ?? 0,
      fees: carDisplay.estimatedFeesAmount ?? null,
    },
  ];

  const segments: LedgerSegment[] = draft.map((segment) => ({
    ...segment,
    total: segment.base + (segment.fees ?? 0),
  }));

  const base = segments.reduce((sum, segment) => sum + segment.base, 0);
  const modeledFees = segments.reduce(
    (sum, segment) => sum + (segment.fees ?? 0),
    0,
  );
  const total = base + modeledFees;

  return {
    segments,
    base,
    modeledFees,
    total,
    perTraveler:
      input.travelers > 0 ? Math.round(total / input.travelers) : total,
    unmodeledFeeSegments: segments
      .filter((segment) => segment.fees == null)
      .map((segment) => segment.label),
    currencyCode:
      stayDisplay.currencyCode ??
      flightDisplay.currencyCode ??
      DEFAULT_CURRENCY_CODE,
  };
};

/** Segment share of the roll-up bar, guarding against a zero total. */
export const segmentSharePercent = (segment: LedgerSegment, total: number) =>
  total > 0 ? (segment.total / total) * 100 : 0;
