/**
 * CLAUDE-UI-051 — Bureau shared chrome (design preview).
 *
 * DEV / DESIGN-PREVIEW ONLY. The pieces every Bureau surface repeats: the
 * grotesque stack, the masthead + vertical tabs, and the uppercase micro-label
 * that replaces section headings.
 */
import { component$, Slot } from "@builder.io/qwik";

/**
 * Bureau sets its own face rather than inheriting the site's Lexend. A neutral
 * grotesque is the direction's whole premise, and this stack resolves to one on
 * every platform without shipping a webfont.
 */
export const BUREAU_GROTESQUE =
  "Helvetica, 'Helvetica Neue', 'Liberation Sans', Arial, var(--system-font-family)";

export const BUREAU_VERTICALS = [
  "Stays",
  "Flights",
  "Cars",
  "Destinations",
  "Trips",
] as const;

export type BureauVertical = (typeof BUREAU_VERTICALS)[number];

/** Uppercase micro-label. Bureau's substitute for a styled section heading. */
export const BureauLabel = component$(() => (
  <p
    class="m-0 pb-1 text-[10px] font-bold uppercase"
    style="color:var(--ui-text-muted);letter-spacing:0.16em;border-bottom:1px solid var(--ui-divider)"
  >
    <Slot />
  </p>
));

/** Masthead: letterspaced wordmark, text tabs, one heavy rule underneath. */
export const BureauTabs = component$((props: { active: BureauVertical }) => (
  <div
    class="flex flex-wrap items-baseline gap-x-6 gap-y-2 px-5 pt-4 pb-2"
    style="border-bottom:3px solid var(--ui-text)"
  >
    <span
      class="text-[12px] font-bold uppercase"
      style={`color:var(--ui-text);letter-spacing:0.3em;font-family:${BUREAU_GROTESQUE}`}
    >
      Andacity
    </span>
    <nav
      class="flex flex-wrap gap-x-5 gap-y-1"
      aria-label="Bureau preview verticals"
    >
      {BUREAU_VERTICALS.map((vertical) => {
        const isActive = vertical === props.active;
        return (
          <span
            key={vertical}
            aria-current={isActive ? "page" : undefined}
            class="pb-0.5 text-[11px] uppercase"
            style={`letter-spacing:0.15em;font-family:${BUREAU_GROTESQUE};color:${
              isActive ? "var(--ui-text)" : "var(--ui-text-muted)"
            };font-weight:${isActive ? 700 : 400};${
              isActive ? "box-shadow:inset 0 -3px 0 var(--ui-accent)" : ""
            }`}
          >
            {vertical}
          </span>
        );
      })}
    </nav>
  </div>
));
