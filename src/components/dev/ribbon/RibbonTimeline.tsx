/**
 * CLAUDE-UI-053 — Ribbon timeline (design preview).
 *
 * DEV / DESIGN-PREVIEW ONLY. One time axis, one lane per vertical, and the
 * analyzer's gaps drawn as spans in the row where they belong. Bureau is
 * near-monochrome, so lanes separate by fill weight rather than hue and the only
 * colored element is a gap — which is the one thing that wants attention.
 */
import { component$ } from "@builder.io/qwik";
import { BureauLabel } from "~/components/dev/bureau/BureauChrome";
import {
  formatRibbonDay,
  type RibbonTimeline as RibbonTimelineModel,
} from "./ribbonModel";

const LANE_FILL: Record<string, string> = {
  flight: "var(--ui-text)",
  hotel: "var(--ui-text-secondary)",
  car: "var(--ui-text-muted)",
};

export const RibbonTimeline = component$(
  (props: { timeline: RibbonTimelineModel }) => {
    const { timeline } = props;

    return (
      <div>
        <BureauLabel>
          {formatRibbonDay(timeline.windowStart)} —{" "}
          {formatRibbonDay(timeline.windowEnd)} · {timeline.totalDays} days
        </BureauLabel>

        {/* Dense horizontally by nature, so it scrolls in its own container. */}
        <div class="mt-2 overflow-x-auto">
          <div class="min-w-[42rem]">
            {/* Axis */}
            <div class="grid grid-cols-[3.5rem_minmax(0,1fr)] items-end gap-x-3">
              <span />
              <div
                class="relative h-5"
                style="border-bottom:1px solid var(--ui-border)"
              >
                {timeline.ticks.map((tick) => (
                  <span
                    key={tick.date}
                    class="absolute bottom-0.5 text-[10px] whitespace-nowrap"
                    style={`left:${tick.leftPct}%;transform:translateX(${
                      // The closing tick sits at 100% and would run off the axis.
                      tick.leftPct > 95 ? "-100%" : "-2px"
                    });color:var(--ui-text-muted);letter-spacing:0.06em`}
                  >
                    {formatRibbonDay(tick.date)}
                  </span>
                ))}
              </div>
            </div>

            {/* Lanes */}
            {timeline.lanes.map((lane) => (
              <div
                key={lane.itemType}
                class="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 py-1.5"
                style="border-bottom:1px solid var(--ui-divider)"
              >
                <span
                  class="text-right text-[10px] font-bold uppercase"
                  style="color:var(--ui-text-muted);letter-spacing:0.14em"
                >
                  {lane.label}
                </span>
                <div
                  class="relative h-8"
                  style="background:repeating-linear-gradient(to right, var(--ui-divider) 0 1px, transparent 1px 20%)"
                >
                  {lane.bars.length === 0 ? (
                    <span
                      class="absolute inset-y-0 left-0 flex items-center text-[11px]"
                      style="color:var(--ui-text-muted)"
                    >
                      Nothing booked
                    </span>
                  ) : null}
                  {lane.bars.map((bar) => (
                    <div
                      key={bar.id}
                      class="absolute top-1 bottom-1 flex items-center gap-2 overflow-hidden px-2"
                      style={`left:${bar.leftPct}%;width:${bar.widthPct}%;background:${
                        LANE_FILL[bar.itemType]
                      };color:var(--ui-bg)`}
                      title={`${bar.title} · ${bar.startDate} → ${bar.endDate}`}
                    >
                      <span class="truncate text-[11px] font-bold">
                        {bar.title}
                      </span>
                      {/* A same-day bar has no room for both; the title wins. */}
                      {bar.days >= 1 ? (
                        <span class="truncate text-[10px] opacity-80">
                          {bar.detail}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Gap lane — the analyzer's own spans, placed where they fall. */}
            <div class="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 py-1.5">
              <span
                class="text-right text-[10px] font-bold uppercase"
                style="color:var(--ui-warning);letter-spacing:0.14em"
              >
                Gaps
              </span>
              <div class="relative h-8">
                {timeline.gapSpans.filter((gap) => gap.leftPct != null)
                  .length === 0 ? (
                  <span
                    class="absolute inset-y-0 left-0 flex items-center text-[11px]"
                    style="color:var(--ui-text-muted)"
                  >
                    No dated gaps
                  </span>
                ) : null}
                {timeline.gapSpans.map((gap) =>
                  gap.leftPct == null || gap.widthPct == null ? null : (
                    <div
                      key={gap.id}
                      class="absolute top-1 bottom-1 flex items-center overflow-hidden px-2"
                      style={`left:${gap.leftPct}%;width:${gap.widthPct}%;border:1.5px dashed var(--ui-warning);color:var(--ui-warning);background:var(--ui-warning-soft)`}
                      title={gap.description}
                    >
                      <span
                        class="truncate text-[10px] font-bold uppercase"
                        style="letter-spacing:0.08em"
                      >
                        {gap.title}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>

        {timeline.undatedItems.length ? (
          <p class="m-0 mt-2 text-[11px]" style="color:var(--ui-warning)">
            {timeline.undatedItems.length} item(s) have no dates and cannot be
            placed on the axis:{" "}
            {timeline.undatedItems.map((item) => item.title).join(", ")}.
          </p>
        ) : null}
      </div>
    );
  },
);
