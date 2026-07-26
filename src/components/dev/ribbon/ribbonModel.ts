/**
 * CLAUDE-UI-053 — Ribbon design-preview model.
 *
 * DEV / DESIGN-PREVIEW ONLY. Ribbon lays every trip item on one shared time
 * axis, so this module computes geometry and nothing else.
 *
 * It deliberately does not analyse the trip. `tripGapAnalyzer` and
 * `validateTripItineraryCoherence` already do that, are already tested, and are
 * what the production trip page reasons with — a second implementation here
 * could disagree with the real one, which is the worst possible outcome for a
 * surface whose job is catching itinerary mistakes. Ribbon positions what those
 * analyzers return; the domain decides what is wrong.
 *
 * Date math comes from `~/lib/trips/date-utils` for the same reason.
 */
import {
  addDays,
  compareIsoDate,
  differenceInDays,
  isIsoDate,
  maxIsoDate,
  minIsoDate,
} from "~/lib/trips/date-utils";
import type {
  TripBundlingGap,
  TripItemType,
  TripValidationIssue,
} from "~/types/trips/trip";

export type RibbonItem = {
  id: number;
  itemType: TripItemType;
  title: string;
  detail: string;
  startDate: string | null;
  endDate: string | null;
};

export type RibbonBar = {
  id: number;
  itemType: TripItemType;
  title: string;
  detail: string;
  startDate: string;
  endDate: string;
  /** Percent offset from the window start. */
  leftPct: number;
  /** Percent of the window this item spans. */
  widthPct: number;
  /** Whole days covered; 0 for a same-day item such as a flight. */
  days: number;
};

export type RibbonLane = {
  itemType: TripItemType;
  label: string;
  bars: RibbonBar[];
};

export type RibbonGapSpan = {
  id: string;
  gapType: TripBundlingGap["gapType"];
  priority: TripBundlingGap["priority"];
  title: string;
  description: string;
  /** Null when the gap has no dates and therefore cannot be placed. */
  leftPct: number | null;
  widthPct: number | null;
};

export type RibbonTimeline = {
  windowStart: string;
  windowEnd: string;
  /** Inclusive day count of the axis; always at least 1. */
  totalDays: number;
  ticks: Array<{ date: string; leftPct: number }>;
  lanes: RibbonLane[];
  gapSpans: RibbonGapSpan[];
  issues: TripValidationIssue[];
  /** Items the axis cannot place, surfaced rather than silently dropped. */
  undatedItems: Array<{ id: number; title: string; itemType: TripItemType }>;
};

const LANE_ORDER: ReadonlyArray<{ itemType: TripItemType; label: string }> = [
  { itemType: "flight", label: "Air" },
  { itemType: "hotel", label: "Stay" },
  { itemType: "car", label: "Car" },
];

/**
 * A same-day item (a flight) has zero duration on a day-resolution axis, so it
 * would render as a zero-width bar. Give it a floor wide enough to read and to
 * click, expressed in days so the axis stays the single source of scale.
 */
const MIN_BAR_DAYS = 0.35;

const itemStart = (item: RibbonItem) =>
  isIsoDate(item.startDate) ? item.startDate : null;

/** Flights carry only a service date; treat a missing end as same-day. */
const itemEnd = (item: RibbonItem) =>
  isIsoDate(item.endDate) ? item.endDate : itemStart(item);

export const resolveRibbonWindow = (
  items: readonly RibbonItem[],
  tripStartDate?: string | null,
  tripEndDate?: string | null,
) => {
  const starts = items.map(itemStart);
  const ends = items.map(itemEnd);

  const start = minIsoDate(tripStartDate, ...starts, ...ends);
  const end = maxIsoDate(tripEndDate, ...starts, ...ends);

  return { start, end };
};

const clampPct = (value: number) => Math.min(100, Math.max(0, value));

/**
 * Places a span so it stays inside the axis without ever collapsing. Clamping
 * width against the offset would erase anything sitting on the final day — a
 * "book your return" gap lands exactly there — so the span shifts left instead.
 */
const placeSpan = (rawLeftPct: number, days: number, totalDays: number) => {
  const widthPct = clampPct((Math.max(days, MIN_BAR_DAYS) / totalDays) * 100);
  return {
    leftPct: Math.max(0, Math.min(rawLeftPct, 100 - widthPct)),
    widthPct,
  };
};

export const buildRibbonTimeline = (input: {
  items: readonly RibbonItem[];
  gaps: readonly TripBundlingGap[];
  issues: readonly TripValidationIssue[];
  tripStartDate?: string | null;
  tripEndDate?: string | null;
}): RibbonTimeline | null => {
  const { start, end } = resolveRibbonWindow(
    input.items,
    input.tripStartDate,
    input.tripEndDate,
  );
  if (!start || !end) return null;

  // An inclusive window: a single-day trip is one day wide, not zero.
  const spanDays = differenceInDays(start, end) ?? 0;
  const totalDays = Math.max(1, spanDays);

  const toPct = (date: string) => {
    const offset = differenceInDays(start, date);
    return offset == null ? null : clampPct((offset / totalDays) * 100);
  };

  const undatedItems: RibbonTimeline["undatedItems"] = [];

  const bars: RibbonBar[] = [];
  for (const item of input.items) {
    const barStart = itemStart(item);
    const barEnd = itemEnd(item);

    if (!barStart || !barEnd) {
      undatedItems.push({
        id: item.id,
        title: item.title,
        itemType: item.itemType,
      });
      continue;
    }

    const leftPct = toPct(barStart);
    if (leftPct == null) {
      undatedItems.push({
        id: item.id,
        title: item.title,
        itemType: item.itemType,
      });
      continue;
    }

    const days = Math.max(0, differenceInDays(barStart, barEnd) ?? 0);
    const placed = placeSpan(leftPct, days, totalDays);

    bars.push({
      id: item.id,
      itemType: item.itemType,
      title: item.title,
      detail: item.detail,
      startDate: barStart,
      endDate: barEnd,
      leftPct: placed.leftPct,
      widthPct: placed.widthPct,
      days,
    });
  }

  const lanes: RibbonLane[] = LANE_ORDER.map(({ itemType, label }) => ({
    itemType,
    label,
    bars: bars
      .filter((bar) => bar.itemType === itemType)
      .sort((a, b) => compareIsoDate(a.startDate, b.startDate) ?? 0),
  }));

  const gapSpans: RibbonGapSpan[] = input.gaps.map((gap) => {
    const gapStart = isIsoDate(gap.startDate) ? gap.startDate : null;
    const gapEnd = isIsoDate(gap.endDate) ? gap.endDate : gapStart;
    const leftPct = gapStart ? toPct(gapStart) : null;

    if (leftPct == null || !gapStart || !gapEnd) {
      return {
        id: gap.id,
        gapType: gap.gapType,
        priority: gap.priority,
        title: gap.title,
        description: gap.description,
        leftPct: null,
        widthPct: null,
      };
    }

    const days = Math.max(0, differenceInDays(gapStart, gapEnd) ?? 0);
    const placed = placeSpan(leftPct, days, totalDays);

    return {
      id: gap.id,
      gapType: gap.gapType,
      priority: gap.priority,
      title: gap.title,
      description: gap.description,
      leftPct: placed.leftPct,
      widthPct: placed.widthPct,
    };
  });

  const ticks: RibbonTimeline["ticks"] = [];
  for (let offset = 0; offset <= totalDays; offset += 1) {
    const date = addDays(start, offset);
    const leftPct = date ? toPct(date) : null;
    if (date && leftPct != null) ticks.push({ date, leftPct });
  }

  return {
    windowStart: start,
    windowEnd: end,
    totalDays,
    ticks,
    lanes,
    gapSpans,
    issues: [...input.issues],
    undatedItems,
  };
};

export const formatRibbonDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
  });

export const RIBBON_ISSUE_SEVERITY_ORDER = ["blocking", "warning"] as const;

export const sortRibbonIssues = (issues: readonly TripValidationIssue[]) =>
  [...issues].sort((a, b) => {
    const rank = (severity: TripValidationIssue["severity"]) =>
      severity === "blocking" ? 0 : 1;
    return rank(a.severity) - rank(b.severity);
  });
