/**
 * CLAUDE-UI-053 — Ribbon direction preview.
 *
 * DEV / DESIGN-PREVIEW ONLY. Not a production surface. Ribbon is the trip-page
 * layer of the Bureau stack, so it renders inside `data-palette="bureau"`.
 *
 * Rendered by the noindex, prod-gated route at /dev/ui-ribbon.
 */
import { component$, useSignal } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import { BureauLabel, BureauTabs } from "~/components/dev/bureau/BureauChrome";
import { RibbonTimeline } from "./RibbonTimeline";
import { buildRibbonTimeline, sortRibbonIssues } from "./ribbonModel";
import {
  RIBBON_GAPS,
  RIBBON_ISSUES,
  RIBBON_ITEMS,
  RIBBON_TRIP,
} from "./ribbonScenario";

export const RibbonPreview = component$(() => {
  const location = useLocation();
  const mode = useSignal<"light" | "dark">(
    location.url.searchParams.get("mode") === "dark" ? "dark" : "light",
  );

  const timeline = buildRibbonTimeline({
    items: RIBBON_ITEMS,
    gaps: RIBBON_GAPS,
    issues: RIBBON_ISSUES,
    tripStartDate: RIBBON_TRIP.startDate,
    tripEndDate: RIBBON_TRIP.endDate,
  });

  const issues = timeline ? sortRibbonIssues(timeline.issues) : [];

  return (
    <main class="mx-auto flex max-w-[1100px] flex-col gap-8 px-5 py-10">
      <header class="flex flex-col gap-3">
        <p
          class="m-0 text-[11px] font-bold uppercase"
          style="color:var(--color-danger);letter-spacing:0.16em"
        >
          Dev preview · not a production page
        </p>
        <h1 class="m-0 text-3xl" style="color:var(--color-text-strong)">
          Ribbon — direction preview
        </h1>
        <p
          class="m-0 max-w-[68ch] text-sm"
          style="color:var(--color-text-muted)"
        >
          One time axis for the whole trip. Every gap and warning below is real
          output from <code>tripGapAnalyzer</code> and{" "}
          <code>validateTripItineraryCoherence</code> — Ribbon positions what
          the domain already decides, so it can never disagree with the trip
          page.
        </p>
        <p
          class="m-0 max-w-[68ch] text-sm"
          style="color:var(--color-text-muted)"
        >
          The pitch pointed at <code>trip-page-model.ts</code> for this data.
          That was wrong: it emits display labels, not the ISO dates an axis
          needs. The coordinates come from the trip items themselves, and the
          analysis from the two modules above — which already existed, so less
          of this is new code than the pitch assumed.
        </p>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-pressed={mode.value === "dark"}
            onClick$={() => {
              mode.value = mode.value === "dark" ? "light" : "dark";
            }}
            class="cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold"
            style="background:var(--color-action);color:#fff;border:1px solid var(--color-action)"
          >
            {mode.value === "dark" ? "Viewing dark" : "Viewing light"}
          </button>
          <span class="text-xs" style="color:var(--color-text-muted)">
            A deliberately half-planned trip: outbound booked, no return, stay a
            night short, car picked up late.
          </span>
        </div>
      </header>

      <div data-palette="bureau" data-mode={mode.value}>
        <div
          class="flex flex-col"
          style="border:1px solid var(--color-border);background:var(--ui-bg);color:var(--ui-text);font-family:Helvetica,'Helvetica Neue','Liberation Sans',Arial,var(--system-font-family)"
        >
          <BureauTabs active="Trips" />

          <div class="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-5 pt-4 pb-3 text-[13px]">
            <span class="font-bold tracking-tight">{RIBBON_TRIP.name}</span>
            <span style="color:var(--ui-text-secondary)">
              {RIBBON_TRIP.travelers} travelers
            </span>
            <span
              class="ms-auto tabular-nums"
              style="color:var(--ui-text-muted)"
            >
              {RIBBON_ITEMS.length} items · {RIBBON_GAPS.length} gaps ·{" "}
              {RIBBON_ISSUES.length} warnings
            </span>
          </div>

          <div class="flex flex-col gap-8 px-5 pb-6">
            {timeline ? (
              <RibbonTimeline timeline={timeline} />
            ) : (
              <p class="m-0 text-[12px]" style="color:var(--ui-text-muted)">
                This trip has no dated items, so there is no axis to draw.
              </p>
            )}

            <div>
              <BureauLabel>What the domain flagged</BureauLabel>
              {issues.length || RIBBON_GAPS.length ? (
                <ul class="m-0 mt-2 flex list-none flex-col p-0">
                  {issues.map((issue) => (
                    <li
                      key={`${issue.code}-${issue.itemId ?? "trip"}`}
                      class="grid grid-cols-[5rem_minmax(0,1fr)] items-baseline gap-x-3 py-1.5 text-[12px]"
                      style="border-bottom:1px solid var(--ui-divider)"
                    >
                      <span
                        class="text-[10px] font-bold uppercase"
                        style={`letter-spacing:0.12em;color:${
                          issue.severity === "blocking"
                            ? "var(--ui-danger)"
                            : "var(--ui-warning)"
                        }`}
                      >
                        {issue.severity}
                      </span>
                      <span style="color:var(--ui-text-secondary)">
                        {issue.message}
                      </span>
                    </li>
                  ))}
                  {RIBBON_GAPS.map((gap) => (
                    <li
                      key={gap.id}
                      class="grid grid-cols-[5rem_minmax(0,1fr)] items-baseline gap-x-3 py-1.5 text-[12px]"
                      style="border-bottom:1px solid var(--ui-divider)"
                    >
                      <span
                        class="text-[10px] font-bold uppercase"
                        style="letter-spacing:0.12em;color:var(--ui-warning)"
                      >
                        {gap.priority} gap
                      </span>
                      <span style="color:var(--ui-text-secondary)">
                        <b>{gap.title}</b> — {gap.description}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p
                  class="m-0 mt-2 text-[12px]"
                  style="color:var(--ui-text-muted)"
                >
                  Nothing flagged.
                </p>
              )}
            </div>

            {/* The honest finding: the eye beats the rule engine here. */}
            <div>
              <BureauLabel>What the domain missed</BureauLabel>
              <p
                class="m-0 mt-2 max-w-[70ch] text-[12px]"
                style="color:var(--ui-text-secondary)"
              >
                Look at the Stay lane: it ends a full day before the trip window
                does, so the last night is unbooked. No rule fires for this —{" "}
                <code>tripGapAnalyzer</code> checks for lodging at{" "}
                <em>arrival</em> and never for coverage through{" "}
                <em>departure</em>, so a stay that stops short is invisible to
                it. The ribbon shows the hole anyway, because a hole on a time
                axis is just empty space. That is the argument for this
                direction, and it is also a concrete gap worth closing in the
                analyzer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
});
