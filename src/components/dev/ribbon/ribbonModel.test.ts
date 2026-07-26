import assert from "node:assert/strict";
import test from "node:test";

import type {
  TripBundlingGap,
  TripValidationIssue,
} from "../../../types/trips/trip.ts";

const ribbonModelModule: typeof import("./ribbonModel.ts") = await import(
  new URL("./ribbonModel.ts", import.meta.url).href
);

const { buildRibbonTimeline, resolveRibbonWindow, sortRibbonIssues } =
  ribbonModelModule;

type RibbonItem = Parameters<typeof buildRibbonTimeline>[0]["items"][number];

const item = (overrides: Partial<RibbonItem> = {}): RibbonItem => ({
  id: 1,
  itemType: "hotel",
  title: "Grand Meridian Collection",
  detail: "3 nights",
  startDate: "2026-07-25",
  endDate: "2026-07-28",
  ...overrides,
});

const gap = (overrides: Partial<TripBundlingGap> = {}): TripBundlingGap => ({
  id: "gap-1",
  gapType: "missing_return_flight",
  priority: "high",
  targetItemType: "flight",
  title: "Add return flight",
  description: "No return flight yet.",
  startDate: "2026-07-29",
  endDate: null,
  cityId: null,
  cityName: null,
  originCityId: null,
  originCityName: null,
  destinationCityId: null,
  destinationCityName: null,
  relatedItemIds: [],
  ...overrides,
});

const build = (
  items: RibbonItem[],
  gaps: TripBundlingGap[] = [],
  issues: TripValidationIssue[] = [],
  tripStartDate: string | null = "2026-07-25",
  tripEndDate: string | null = "2026-07-29",
) => buildRibbonTimeline({ items, gaps, issues, tripStartDate, tripEndDate });

test("resolveRibbonWindow spans the trip dates and every item", () => {
  const window = resolveRibbonWindow(
    [item({ startDate: "2026-07-20", endDate: "2026-07-22" })],
    "2026-07-25",
    "2026-07-29",
  );

  // An item outside the declared trip window still has to be visible.
  assert.equal(window.start, "2026-07-20");
  assert.equal(window.end, "2026-07-29");
});

test("buildRibbonTimeline returns null when nothing can be dated", () => {
  assert.equal(
    buildRibbonTimeline({
      items: [item({ startDate: null, endDate: null })],
      gaps: [],
      issues: [],
    }),
    null,
  );
});

test("buildRibbonTimeline positions a bar proportionally in the window", () => {
  const timeline = build([
    item({ startDate: "2026-07-27", endDate: "2026-07-29" }),
  ]);

  const [bar] = timeline!.lanes.find((lane) => lane.itemType === "hotel")!.bars;
  // Day 2 of a 4-day window starts halfway across and runs to the end.
  assert.equal(timeline!.totalDays, 4);
  assert.equal(bar.leftPct, 50);
  assert.equal(bar.widthPct, 50);
  assert.equal(bar.days, 2);
});

test("buildRibbonTimeline gives a same-day item a visible minimum width", () => {
  const timeline = build([
    item({
      itemType: "flight",
      startDate: "2026-07-25",
      endDate: "2026-07-25",
    }),
  ]);

  const [bar] = timeline!.lanes.find(
    (lane) => lane.itemType === "flight",
  )!.bars;
  assert.equal(bar.days, 0);
  assert.ok(bar.widthPct > 0, "a zero-duration flight must still be visible");
});

test("buildRibbonTimeline treats a missing end date as same-day", () => {
  const timeline = build([
    item({ itemType: "flight", startDate: "2026-07-25", endDate: null }),
  ]);

  const [bar] = timeline!.lanes.find(
    (lane) => lane.itemType === "flight",
  )!.bars;
  assert.equal(bar.startDate, "2026-07-25");
  assert.equal(bar.endDate, "2026-07-25");
});

test("buildRibbonTimeline never lets a bar overflow the axis", () => {
  const timeline = build([
    item({ startDate: "2026-07-29", endDate: "2026-08-30" }),
  ]);

  const [bar] = timeline!.lanes.find((lane) => lane.itemType === "hotel")!.bars;
  assert.ok(bar.leftPct + bar.widthPct <= 100.0001);
});

test("buildRibbonTimeline reports undated items instead of dropping them", () => {
  const timeline = build([
    item({ id: 1 }),
    item({
      id: 2,
      title: "Mystery car",
      itemType: "car",
      startDate: null,
      endDate: null,
    }),
  ]);

  assert.deepEqual(
    timeline!.undatedItems.map((u) => u.title),
    ["Mystery car"],
  );
});

test("buildRibbonTimeline lays out one lane per vertical in fixed order", () => {
  const timeline = build([item()]);

  assert.deepEqual(
    timeline!.lanes.map((lane) => lane.itemType),
    ["flight", "hotel", "car"],
  );
});

test("buildRibbonTimeline sorts bars within a lane by start date", () => {
  const timeline = build([
    item({ id: 1, startDate: "2026-07-28", endDate: "2026-07-29" }),
    item({ id: 2, startDate: "2026-07-25", endDate: "2026-07-26" }),
  ]);

  assert.deepEqual(
    timeline!.lanes
      .find((lane) => lane.itemType === "hotel")!
      .bars.map((b) => b.id),
    [2, 1],
  );
});

test("buildRibbonTimeline places a gap using the analyzer's own dates", () => {
  const timeline = build(
    [item()],
    [gap({ startDate: "2026-07-25", endDate: "2026-07-27" })],
  );

  const [span] = timeline!.gapSpans;
  assert.equal(span.leftPct, 0);
  assert.equal(span.widthPct, 50);
});

test("buildRibbonTimeline keeps an undated gap but marks it unplaceable", () => {
  const timeline = build([item()], [gap({ startDate: null, endDate: null })]);

  const [span] = timeline!.gapSpans;
  assert.equal(span.leftPct, null);
  assert.equal(span.widthPct, null);
  assert.equal(span.title, "Add return flight");
});

test("a gap on the final day stays visible instead of collapsing", () => {
  // "Add return flight" lands on the last day of the window; clamping its
  // width against the offset used to erase it entirely.
  const timeline = build(
    [item()],
    [gap({ startDate: "2026-07-29", endDate: null })],
  );

  const [span] = timeline!.gapSpans;
  assert.ok(span.widthPct != null && span.widthPct > 0, "must have real width");
  assert.ok(
    span.leftPct != null && span.leftPct < 100,
    "must shift left to fit",
  );
  assert.ok((span.leftPct ?? 0) + (span.widthPct ?? 0) <= 100.0001);
});

test("a bar ending on the final day stays inside the axis", () => {
  const timeline = build([
    item({ startDate: "2026-07-29", endDate: "2026-07-29" }),
  ]);

  const [bar] = timeline!.lanes.find((lane) => lane.itemType === "hotel")!.bars;
  assert.ok(bar.widthPct > 0);
  assert.ok(bar.leftPct + bar.widthPct <= 100.0001);
});

test("buildRibbonTimeline emits an inclusive tick per day", () => {
  const timeline = build([item()]);

  assert.equal(timeline!.ticks.length, 5); // 25th through 29th
  assert.equal(timeline!.ticks[0].date, "2026-07-25");
  assert.equal(timeline!.ticks.at(-1)?.date, "2026-07-29");
});

test("buildRibbonTimeline keeps a single-day trip one day wide", () => {
  const timeline = build(
    [item({ startDate: "2026-07-25", endDate: "2026-07-25" })],
    [],
    [],
    "2026-07-25",
    "2026-07-25",
  );

  assert.equal(timeline!.totalDays, 1);
  assert.equal(timeline!.ticks.length, 2);
});

test("sortRibbonIssues puts blocking issues above warnings", () => {
  const issues: TripValidationIssue[] = [
    { code: "a", scope: "itinerary", severity: "warning", message: "w" },
    { code: "b", scope: "availability", severity: "blocking", message: "b" },
  ];

  assert.deepEqual(
    sortRibbonIssues(issues).map((i) => i.severity),
    ["blocking", "warning"],
  );
});
