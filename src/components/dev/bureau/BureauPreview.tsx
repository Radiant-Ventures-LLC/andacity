/**
 * CLAUDE-UI-051 — Bureau direction preview.
 *
 * DEV / DESIGN-PREVIEW ONLY. Not a production surface. Renders the Bureau
 * direction over the real generated Miami inventory so the skin can be judged
 * against actual names, ratings, policies, and rates.
 *
 * Bureau is scoped by `data-palette="bureau"` on a wrapper rather than <html>,
 * so the dev chrome around it keeps the site's normal theme and the two can be
 * compared side by side. The palette is not registered in `PALETTES`, so it
 * cannot reach the visitor-facing switcher.
 *
 * Rendered by the noindex, prod-gated route at /dev/ui-bureau.
 */
import { component$, useSignal } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import { HOTELS } from "~/data/hotels";
import { BureauResults } from "./BureauResults";
import { BureauDetail } from "./BureauDetail";
import { BUREAU_GROTESQUE } from "./BureauChrome";
import {
  BUREAU_TRIP,
  buildBureauDetail,
  buildBureauFacetGroups,
  buildBureauStays,
  selectBureauHotels,
} from "./bureauModel";

/** Tokens Bureau redefines, shown as a swatch strip so the direction is legible. */
const TOKEN_SWATCHES = [
  { token: "--ui-bg", label: "Ground" },
  { token: "--ui-surface-muted", label: "Muted" },
  { token: "--ui-text", label: "Ink" },
  { token: "--ui-text-muted", label: "Muted ink" },
  { token: "--ui-accent", label: "Signal" },
  { token: "--ui-success", label: "Success" },
];

export const BureauPreview = component$(() => {
  // `?mode=dark` makes each variant a shareable link and lets the preview be
  // screenshotted in either mode without a click.
  const location = useLocation();
  const mode = useSignal<"light" | "dark">(
    location.url.searchParams.get("mode") === "dark" ? "dark" : "light",
  );

  const cityHotels = selectBureauHotels(HOTELS, BUREAU_TRIP.cityQuery);
  const stays = buildBureauStays(cityHotels, BUREAU_TRIP.nights);
  const facetGroups = buildBureauFacetGroups(cityHotels);

  // The detail surface shows the winning stay, so the two surfaces agree.
  const bestSlug = stays.length ? stays[0].slug : "";
  const bestHotel =
    cityHotels.find((hotel) => hotel.slug === bestSlug) || cityHotels[0];
  const detail = bestHotel
    ? buildBureauDetail(bestHotel, BUREAU_TRIP.nights)
    : null;

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
          Bureau — direction preview
        </h1>
        <p
          class="m-0 max-w-[68ch] text-sm"
          style="color:var(--color-text-muted)"
        >
          The Bureau direction applied to real Miami inventory: no photography,
          no gradients, no cards. Hierarchy comes from scale, rules, and
          alignment, and the single signal red is spent only on the lowest total
          and the active tab. Everything below is <code>--ui-*</code> tokens
          plus utilities — no new stylesheet.
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
            Toggles <code>data-mode</code> on the Bureau scope only — the page
            around it keeps the site theme.
          </span>
        </div>
      </header>

      {/* ---- Bureau scope starts here ---- */}
      <div
        data-palette="bureau"
        data-mode={mode.value}
        class="flex flex-col gap-8"
      >
        <figure class="m-0 flex flex-col gap-2">
          <figcaption
            class="text-xs font-semibold"
            style="color:var(--color-text-muted)"
          >
            Search results — /hotels/search/miami/2026-03-14/2026-03-18
          </figcaption>
          <div style="border:1px solid var(--color-border)">
            <BureauResults
              trip={BUREAU_TRIP}
              stays={stays}
              facetGroups={facetGroups}
              activeSlug={bestSlug}
            />
          </div>
        </figure>

        {detail ? (
          <figure class="m-0 flex flex-col gap-2">
            <figcaption
              class="text-xs font-semibold"
              style="color:var(--color-text-muted)"
            >
              Entity page — /hotels/{detail.slug}
            </figcaption>
            <div style="border:1px solid var(--color-border)">
              <BureauDetail
                detail={detail}
                nights={BUREAU_TRIP.nights}
                dateLabel={BUREAU_TRIP.dateLabel}
                travelers={BUREAU_TRIP.travelers}
              />
            </div>
          </figure>
        ) : null}

        <figure class="m-0 flex flex-col gap-2">
          <figcaption
            class="text-xs font-semibold"
            style="color:var(--color-text-muted)"
          >
            Type scale and tokens
          </figcaption>
          <div
            class="flex flex-col gap-5 p-5"
            style={`border:1px solid var(--color-border);background:var(--ui-bg);color:var(--ui-text);font-family:${BUREAU_GROTESQUE}`}
          >
            <div class="flex flex-col gap-1">
              <p
                class="m-0 text-[38px] font-bold"
                style="letter-spacing:-0.038em;line-height:1.04"
              >
                Grand Meridian Collection
              </p>
              <p
                class="m-0 text-[21px] font-bold tabular-nums"
                style="letter-spacing:-0.035em"
              >
                $1,004
              </p>
              <p class="m-0 text-[13px]" style="color:var(--ui-text-secondary)">
                Body copy sits at thirteen pixels and never competes with the
                numerals.
              </p>
              <p
                class="m-0 text-[10px] font-bold uppercase"
                style="color:var(--ui-text-muted);letter-spacing:0.16em"
              >
                Micro-label · 10px · 0.16em
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              {TOKEN_SWATCHES.map((swatch) => (
                <div key={swatch.token} class="flex flex-col gap-1">
                  <div
                    class="h-9 w-20"
                    style={`background:var(${swatch.token});border:1px solid var(--ui-border)`}
                  />
                  <span
                    class="text-[10px] uppercase"
                    style="color:var(--ui-text-muted);letter-spacing:0.1em"
                  >
                    {swatch.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </figure>
      </div>
    </main>
  );
});
