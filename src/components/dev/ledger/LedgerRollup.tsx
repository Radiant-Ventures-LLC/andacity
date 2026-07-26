/**
 * CLAUDE-UI-052 — Ledger trip roll-up (design preview).
 *
 * DEV / DESIGN-PREVIEW ONLY. Four verticals become one budget. The disclosure
 * line is the load-bearing part: the domain models fees for hotels only, so the
 * trip total is genuinely incomplete, and a direction built on honest arithmetic
 * has to say which segments are missing rather than quietly rounding them in.
 */
import { component$ } from "@builder.io/qwik";
import { formatMoney } from "~/lib/pricing/price-display";
import { BureauLabel } from "~/components/dev/bureau/BureauChrome";
import {
  segmentSharePercent,
  type LedgerRollup as LedgerRollupModel,
} from "./ledgerModel";

const SEGMENT_TONE: Record<string, string> = {
  flight: "var(--ui-text)",
  stay: "var(--ui-text-secondary)",
  car: "var(--ui-text-muted)",
};

export const LedgerRollup = component$(
  (props: { rollup: LedgerRollupModel }) => {
    const { rollup } = props;

    return (
      <div>
        <BureauLabel>Trip roll-up</BureauLabel>

        <div
          class="mt-2 flex h-7 w-full overflow-hidden"
          style="border:1px solid var(--ui-border)"
        >
          {rollup.segments.map((segment) => (
            <div
              key={segment.key}
              class="grid place-items-center overflow-hidden text-[10px] font-bold uppercase whitespace-nowrap"
              style={`width:${segmentSharePercent(segment, rollup.total)}%;background:${
                SEGMENT_TONE[segment.key]
              };color:var(--ui-bg);letter-spacing:0.1em`}
              title={`${segment.label} · ${formatMoney(segment.total, rollup.currencyCode)}`}
            >
              {segment.label}
            </div>
          ))}
        </div>

        <dl class="m-0 mt-3 flex flex-col">
          {rollup.segments.map((segment) => (
            <div
              key={segment.key}
              class="grid grid-cols-[minmax(0,1fr)_6rem_6rem] items-baseline gap-x-4 py-1.5 text-[12px]"
              style="border-bottom:1px solid var(--ui-divider)"
            >
              <dt class="min-w-0">
                <span class="block font-bold">{segment.label}</span>
                <span
                  class="block truncate text-[11px]"
                  style="color:var(--ui-text-muted)"
                >
                  {segment.detail}
                </span>
              </dt>
              <dd
                class="m-0 text-right tabular-nums"
                style="color:var(--ui-text-secondary)"
              >
                {formatMoney(segment.base, rollup.currencyCode)}
              </dd>
              {/* An em dash here is a fact about the domain, not a placeholder. */}
              <dd
                class="m-0 text-right tabular-nums"
                style={`color:${segment.fees == null ? "var(--ui-warning)" : "var(--ui-text-secondary)"}`}
              >
                {segment.fees == null
                  ? "not modeled"
                  : `+ ${formatMoney(segment.fees, rollup.currencyCode)}`}
              </dd>
            </div>
          ))}
        </dl>

        <div
          class="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-1"
          style="border-top:2px solid var(--ui-text);padding-top:0.6rem"
        >
          <div>
            <p
              class="m-0 text-[10px] font-bold uppercase"
              style="color:var(--ui-text-muted);letter-spacing:0.14em"
            >
              Estimated so far
            </p>
            <p
              class="m-0 text-[26px] font-bold tabular-nums"
              style="letter-spacing:-0.04em;line-height:1.05"
            >
              {formatMoney(rollup.total, rollup.currencyCode)}
            </p>
          </div>
          <div
            class="text-[12px] tabular-nums"
            style="color:var(--ui-text-secondary)"
          >
            <p class="m-0">
              Base {formatMoney(rollup.base, rollup.currencyCode)}
            </p>
            <p class="m-0">
              Modeled fees +{" "}
              {formatMoney(rollup.modeledFees, rollup.currencyCode)}
            </p>
            <p class="m-0">
              Per traveler{" "}
              {formatMoney(rollup.perTraveler, rollup.currencyCode)}
            </p>
          </div>
        </div>

        {rollup.unmodeledFeeSegments.length ? (
          <p
            class="m-0 mt-3 p-2 text-[11px]"
            style="color:var(--ui-warning);border:1px solid var(--ui-warning);background:var(--ui-warning-soft)"
          >
            This total is incomplete.{" "}
            {rollup.unmodeledFeeSegments.join(" and ")} fees are not modeled
            anywhere in the pricing domain yet, so they are excluded rather than
            guessed. Ledger shows the gap instead of hiding it.
          </p>
        ) : null}
      </div>
    );
  },
);
