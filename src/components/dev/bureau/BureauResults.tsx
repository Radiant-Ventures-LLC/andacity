/**
 * CLAUDE-UI-051 — Bureau results surface (design preview).
 *
 * DEV / DESIGN-PREVIEW ONLY. The Bureau direction removes the card as a unit:
 * hierarchy comes from scale, rules, and alignment, so a result is a row on a
 * ruled grid rather than a bordered box. Everything here is `--ui-*` tokens plus
 * Tailwind utilities — no new stylesheet, which is the point of the direction.
 */
import { component$ } from "@builder.io/qwik";
import {
  formatCount,
  formatUsd,
  type BureauFacetGroup,
  type BureauStay,
  type BureauTrip,
} from "./bureauModel";
import { BUREAU_GROTESQUE, BureauLabel, BureauTabs } from "./BureauChrome";

export type BureauResultsProps = {
  trip: BureauTrip;
  stays: BureauStay[];
  facetGroups: BureauFacetGroup[];
  activeSlug?: string;
};

export const BureauResults = component$((props: BureauResultsProps) => {
  const { trip, stays, facetGroups } = props;

  return (
    <section
      style={`background:var(--ui-bg);color:var(--ui-text);font-family:${BUREAU_GROTESQUE}`}
    >
      <BureauTabs active="Stays" />

      {/* Search summary. Plain text on a rule — no panel, no chips. */}
      <div class="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-5 pt-4 pb-3 text-[13px]">
        <span class="font-bold tracking-tight" style="color:var(--ui-text)">
          {trip.cityLabel}
        </span>
        <span style="color:var(--ui-text-secondary)">{trip.dateLabel}</span>
        <span style="color:var(--ui-text-secondary)">
          {trip.travelers} travelers · {trip.nights} nights
        </span>
        <span class="ms-auto tabular-nums" style="color:var(--ui-text-muted)">
          {stays.length} stays · sorted by total
        </span>
      </div>

      <div class="grid gap-x-8 gap-y-6 px-5 pb-6 md:grid-cols-[9rem_minmax(0,1fr)]">
        {/* Facet rail: label + count, hairline rules, no checkboxes or pills. */}
        <div class="flex flex-col gap-5">
          {facetGroups.map((group) => (
            <div key={group.title}>
              <BureauLabel>{group.title}</BureauLabel>
              <ul class="mt-1.5 flex list-none flex-col gap-1 p-0 text-[12px]">
                {group.facets.map((facet) => (
                  <li
                    key={facet.label}
                    class="flex items-baseline justify-between gap-2"
                  >
                    <span style="color:var(--ui-text-secondary)">
                      {facet.label}
                    </span>
                    <span
                      class="tabular-nums"
                      style="color:var(--ui-text-muted)"
                    >
                      {facet.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Result rows. The top rule is heavy, row rules are hairlines. */}
        <div style="border-top:2px solid var(--ui-text)">
          {stays.map((stay) => (
            <article
              key={stay.slug}
              class="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 py-3 md:grid-cols-[2.25rem_minmax(0,1fr)_13.5rem_7.5rem]"
              style={`border-bottom:1px solid var(--ui-divider);${
                props.activeSlug === stay.slug
                  ? "background:var(--ui-surface-muted)"
                  : ""
              }`}
            >
              <span
                class="text-[11px] tabular-nums"
                style="color:var(--ui-text-muted)"
              >
                {String(stay.index).padStart(2, "0")}
              </span>

              <div class="min-w-0">
                <h3
                  class="m-0 truncate text-[16px] font-bold"
                  style={`color:var(--ui-text);font-family:${BUREAU_GROTESQUE};letter-spacing:-0.018em`}
                >
                  {stay.name}
                </h3>
                <p
                  class="m-0 mt-0.5 text-[12px]"
                  style="color:var(--ui-text-muted)"
                >
                  {stay.qualifier}
                </p>
              </div>

              <div class="col-start-2 text-[12px] md:col-start-3">
                <p class="m-0" style="color:var(--ui-text-secondary)">
                  {stay.attributes.length
                    ? stay.attributes.join(" · ")
                    : "Standard terms"}
                </p>
                <p
                  class="m-0 mt-0.5 tabular-nums"
                  style="color:var(--ui-text-muted)"
                >
                  Rated {stay.rating.toFixed(1)} ·{" "}
                  {formatCount(stay.reviewCount)} reviews
                </p>
              </div>

              {/* The number leads. Signal red is spent only on the lowest total. */}
              <div class="col-start-2 md:col-start-4 md:text-right">
                <p
                  class="m-0 text-[21px] font-bold tabular-nums"
                  style={`letter-spacing:-0.035em;color:${
                    stay.isBest ? "var(--ui-accent)" : "var(--ui-price)"
                  }`}
                >
                  {formatUsd(stay.total)}
                </p>
                <p
                  class="m-0 text-[10px] uppercase tabular-nums"
                  style="color:var(--ui-text-muted);letter-spacing:0.1em"
                >
                  {trip.nights} nights, from
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
});
