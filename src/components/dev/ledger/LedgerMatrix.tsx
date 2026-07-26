/**
 * CLAUDE-UI-052 — Ledger comparison matrix (design preview).
 *
 * DEV / DESIGN-PREVIEW ONLY. Results become a table you compare rather than a
 * list you scroll: fees are a column instead of a checkout surprise, and the
 * all-in nightly rate exposes the stay whose headline rate is a lie.
 *
 * Rendered inside the Bureau palette — Ledger is the results layer of that
 * stack, not a competing skin.
 */
import { component$, type QRL } from "@builder.io/qwik";
import { formatMoney } from "~/lib/pricing/price-display";
import { BureauLabel } from "~/components/dev/bureau/BureauChrome";
import type { LedgerStayRow } from "./ledgerModel";

export type LedgerMatrixProps = {
  rows: LedgerStayRow[];
  pinnedSlugs: string[];
  nights: number;
  supportText: string | null;
  onTogglePin$: QRL<(slug: string) => void>;
};

const HEAD_CELL =
  "px-2 py-1.5 text-[10px] font-bold uppercase whitespace-nowrap text-right";

export const LedgerMatrix = component$((props: LedgerMatrixProps) => {
  const { rows, pinnedSlugs, nights, supportText } = props;

  return (
    <div>
      <BureauLabel>Compare — estimated totals</BureauLabel>

      {/* Dense by design, so the table scrolls in its own container. */}
      <div class="mt-2 overflow-x-auto">
        <table
          class="w-full min-w-[52rem] border-collapse tabular-nums"
          style="color:var(--ui-text)"
        >
          <caption class="sr-only">
            Miami stays compared by estimated total for {nights} nights
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                class="px-2 py-1.5 text-left text-[10px] font-bold uppercase"
                style="color:var(--ui-text-muted);letter-spacing:0.14em;border-bottom:2px solid var(--ui-text)"
              >
                Stay
              </th>
              {[
                "Nightly",
                `Base · ${nights} nts`,
                "Est. fees",
                "Est. total",
                "All-in / night",
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  class={HEAD_CELL}
                  style="color:var(--ui-text-muted);letter-spacing:0.14em;border-bottom:2px solid var(--ui-text)"
                >
                  {label}
                </th>
              ))}
              <th
                scope="col"
                class="px-2 py-1.5 text-left text-[10px] font-bold uppercase whitespace-nowrap"
                style="color:var(--ui-text-muted);letter-spacing:0.14em;border-bottom:2px solid var(--ui-text)"
              >
                Policy
              </th>
              <th
                scope="col"
                class="px-2 py-1.5 text-right text-[10px] font-bold uppercase"
                style="color:var(--ui-text-muted);letter-spacing:0.14em;border-bottom:2px solid var(--ui-text)"
              >
                Pin
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isPinned = pinnedSlugs.includes(row.slug);
              return (
                <tr
                  key={row.slug}
                  style={`border-bottom:1px solid var(--ui-divider);${
                    isPinned ? "background:var(--ui-surface-muted)" : ""
                  }`}
                >
                  <th scope="row" class="px-2 py-2.5 text-left font-normal">
                    <span
                      class="block text-[13px] font-bold"
                      style="letter-spacing:-0.014em"
                    >
                      {row.name}
                    </span>
                    <span
                      class="block text-[11px]"
                      style="color:var(--ui-text-muted)"
                    >
                      {row.area}
                    </span>
                  </th>
                  <td
                    class="px-2 py-2.5 text-right text-[12px]"
                    style="color:var(--ui-text-secondary)"
                  >
                    {formatMoney(row.nightly, row.currencyCode)}
                  </td>
                  <td
                    class="px-2 py-2.5 text-right text-[12px]"
                    style="color:var(--ui-text-secondary)"
                  >
                    {formatMoney(row.baseTotal, row.currencyCode)}
                  </td>
                  {/* The column the industry hides in a footnote. */}
                  <td
                    class="px-2 py-2.5 text-right text-[12px]"
                    style="color:var(--ui-text-secondary)"
                  >
                    + {formatMoney(row.fees, row.currencyCode)}
                  </td>
                  <td
                    class="px-2 py-2.5 text-right text-[16px] font-bold"
                    style={`letter-spacing:-0.03em;color:${
                      row.isBest ? "var(--ui-accent)" : "var(--ui-price)"
                    }`}
                  >
                    {formatMoney(row.total, row.currencyCode)}
                  </td>
                  <td
                    class="px-2 py-2.5 text-right text-[12px]"
                    style="color:var(--ui-text-secondary)"
                  >
                    {formatMoney(row.allInNightly, row.currencyCode)}
                  </td>
                  <td
                    class="px-2 py-2.5 text-[11px]"
                    style="color:var(--ui-text-secondary)"
                  >
                    {[
                      row.refundable ? "Refundable" : "Nonrefundable",
                      row.noResortFees ? "No resort fee" : "Resort fee",
                    ].join(" · ")}
                  </td>
                  <td class="px-2 py-2.5 text-right">
                    <button
                      type="button"
                      aria-pressed={isPinned}
                      aria-label={`${isPinned ? "Unpin" : "Pin"} ${row.name}`}
                      onClick$={() => props.onTogglePin$(row.slug)}
                      class="cursor-pointer px-2 py-1 text-[10px] font-bold uppercase"
                      style={`letter-spacing:0.12em;border:1px solid ${
                        isPinned ? "var(--ui-accent)" : "var(--ui-border)"
                      };color:${isPinned ? "var(--ui-accent)" : "var(--ui-text-muted)"}`}
                    >
                      {isPinned ? "Pinned" : "Pin"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {supportText ? (
        <p class="m-0 mt-2 text-[11px]" style="color:var(--ui-text-muted)">
          {supportText}
        </p>
      ) : null}
    </div>
  );
});
