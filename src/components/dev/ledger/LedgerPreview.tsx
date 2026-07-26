/**
 * CLAUDE-UI-052 — Ledger direction preview.
 *
 * DEV / DESIGN-PREVIEW ONLY. Not a production surface. Ledger is the results
 * layer of the Bureau stack, so it renders inside `data-palette="bureau"` rather
 * than introducing a palette of its own.
 *
 * Rendered by the noindex, prod-gated route at /dev/ui-ledger.
 */
import { $, component$, useComputed$, useSignal } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import { BureauTabs } from "~/components/dev/bureau/BureauChrome";
import { LedgerMatrix } from "./LedgerMatrix";
import { LedgerRollup } from "./LedgerRollup";
import {
  buildLedgerRollup,
  buildLedgerStayRows,
  sortLedgerRows,
  togglePinned,
} from "./ledgerModel";
import {
  LEDGER_CAR,
  LEDGER_FLIGHT,
  LEDGER_HOTELS,
  LEDGER_TRIP,
} from "./ledgerScenario";

export const LedgerPreview = component$(() => {
  const location = useLocation();
  const mode = useSignal<"light" | "dark">(
    location.url.searchParams.get("mode") === "dark" ? "dark" : "light",
  );
  const pinnedSlugs = useSignal<string[]>([]);

  const staySet = buildLedgerStayRows(LEDGER_HOTELS, {
    nights: LEDGER_TRIP.nights,
  });

  const orderedRows = useComputed$(() =>
    sortLedgerRows(staySet.rows, pinnedSlugs.value),
  );

  const cheapestStay = staySet.rows.length ? staySet.rows[0] : null;

  const rollup =
    LEDGER_FLIGHT && LEDGER_CAR && cheapestStay
      ? buildLedgerRollup({
          flight: {
            ...LEDGER_FLIGHT,
            itineraryLabel: "round trip",
          },
          stay: {
            name: cheapestStay.name,
            nightly: cheapestStay.nightly,
            currency: cheapestStay.currencyCode,
          },
          car: {
            name: LEDGER_CAR.name,
            pickupArea: LEDGER_CAR.pickupArea,
            fromDaily: LEDGER_CAR.fromDaily,
            currency: LEDGER_CAR.currency,
          },
          nights: LEDGER_TRIP.nights,
          carDays: LEDGER_TRIP.carDays,
          travelers: LEDGER_TRIP.travelers,
        })
      : null;

  const handleTogglePin = $((slug: string) => {
    pinnedSlugs.value = togglePinned(pinnedSlugs.value, slug);
  });

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
          Ledger — direction preview
        </h1>
        <p
          class="m-0 max-w-[68ch] text-sm"
          style="color:var(--color-text-muted)"
        >
          Results as a comparison matrix, with fees promoted from a checkout
          surprise to a column. Every figure comes from{" "}
          <code>buildHotelPriceDisplay</code> in{" "}
          <code>src/lib/pricing/price-display.ts</code> — the same contract
          production uses — so nothing on this page is arithmetic I invented.
        </p>
        <p
          class="m-0 max-w-[68ch] text-sm"
          style="color:var(--color-text-muted)"
        >
          Two things the pitch got wrong, corrected here: there is no price
          history in the domain, so the 30-day sparkline is gone; and the flight
          and car builders return <code>estimatedFeesAmount: null</code>, so the
          trip total is incomplete and says so.
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
            Pin rows to lift them to the top — comparison only works if the
            things being compared stay adjacent.
          </span>
        </div>
      </header>

      <div data-palette="bureau" data-mode={mode.value}>
        <div
          class="flex flex-col"
          style="border:1px solid var(--color-border);background:var(--ui-bg);color:var(--ui-text);font-family:Helvetica,'Helvetica Neue','Liberation Sans',Arial,var(--system-font-family)"
        >
          <BureauTabs active="Stays" />

          <div class="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-5 pt-4 pb-3 text-[13px]">
            <span class="font-bold tracking-tight">
              {LEDGER_TRIP.cityLabel}
            </span>
            <span style="color:var(--ui-text-secondary)">
              {LEDGER_TRIP.dateLabel}
            </span>
            <span style="color:var(--ui-text-secondary)">
              {LEDGER_TRIP.travelers} travelers · {LEDGER_TRIP.nights} nights
            </span>
            <span
              class="ms-auto tabular-nums"
              style="color:var(--ui-text-muted)"
            >
              {pinnedSlugs.value.length} pinned
            </span>
          </div>

          <div class="flex flex-col gap-8 px-5 pb-6">
            <LedgerMatrix
              rows={orderedRows.value}
              pinnedSlugs={pinnedSlugs.value}
              nights={staySet.nights}
              supportText={staySet.supportText}
              onTogglePin$={handleTogglePin}
            />

            {rollup ? <LedgerRollup rollup={rollup} /> : null}
          </div>
        </div>
      </div>
    </main>
  );
});
