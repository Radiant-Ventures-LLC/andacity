/**
 * CLAUDE-UI-051 — Bureau entity surface (design preview).
 *
 * DEV / DESIGN-PREVIEW ONLY. The stress test for the direction: an entity page
 * is where every other skin reaches for a photo gallery, and Bureau has no
 * photography. Hierarchy is carried by an inverted ink block, a strict fact
 * grid, and ruled room rows.
 */
import { component$ } from "@builder.io/qwik";
import {
  formatCount,
  formatUsd,
  type BureauDetail as BureauDetailModel,
} from "./bureauModel";
import { BUREAU_GROTESQUE, BureauLabel, BureauTabs } from "./BureauChrome";

export type BureauDetailProps = {
  detail: BureauDetailModel;
  nights: number;
  dateLabel: string;
  travelers: number;
};

export const BureauDetail = component$((props: BureauDetailProps) => {
  const { detail, nights, dateLabel, travelers } = props;

  const facts: Array<{ label: string; value: string }> = [
    {
      label: "Rating",
      value: `${detail.rating.toFixed(1)} · ${formatCount(detail.reviewCount)} reviews`,
    },
    {
      label: "Class",
      value: `${detail.stars} star ${detail.propertyType.toLowerCase()}`,
    },
    { label: "Area", value: detail.neighborhood },
    { label: "Address", value: detail.addressLine },
    { label: "Check in", value: detail.checkInTime },
    { label: "Check out", value: detail.checkOutTime },
  ];

  return (
    <section
      style={`background:var(--ui-bg);color:var(--ui-text);font-family:${BUREAU_GROTESQUE}`}
    >
      <BureauTabs active="Stays" />

      <p
        class="m-0 px-5 pt-4 text-[11px] uppercase"
        style="color:var(--ui-text-muted);letter-spacing:0.15em"
      >
        Stays / {detail.city} / {detail.neighborhood}
      </p>

      <div class="px-5 pt-1 pb-4">
        <h2
          class="m-0 text-[30px] font-bold sm:text-[38px]"
          style={`color:var(--ui-text);font-family:${BUREAU_GROTESQUE};letter-spacing:-0.035em;line-height:1.04`}
        >
          {detail.name}
        </h2>
        <p
          class="m-0 mt-1 max-w-[60ch] text-[13px]"
          style="color:var(--ui-text-secondary)"
        >
          {detail.summary}
        </p>
      </div>

      {/* The one block of mass on the page. No gradient — --ui-hero is flat here. */}
      <div
        class="mx-5 flex flex-wrap items-end justify-between gap-4 p-4"
        style="background:var(--ui-hero);color:var(--ui-on-primary)"
      >
        <div>
          <p
            class="m-0 text-[10px] uppercase"
            style="letter-spacing:0.16em;opacity:0.72"
          >
            {dateLabel} · {nights} nights · {travelers} travelers
          </p>
          <p
            class="m-0 mt-1 text-[34px] font-bold tabular-nums"
            style="letter-spacing:-0.04em;line-height:1"
          >
            {formatUsd(detail.total)}
          </p>
          <p class="m-0 text-[11px] tabular-nums" style="opacity:0.72">
            {formatUsd(detail.nightly)} per night, before taxes and fees
          </p>
        </div>
        <span
          class="px-4 py-2 text-[12px] font-bold uppercase"
          style="letter-spacing:0.14em;border:1px solid var(--ui-on-primary)"
        >
          Select a room
        </span>
      </div>

      <div class="grid gap-x-8 gap-y-6 px-5 py-6 md:grid-cols-[minmax(0,1fr)_13rem]">
        <div>
          <BureauLabel>Rooms</BureauLabel>
          <div class="mt-2" style="border-top:2px solid var(--ui-text)">
            {detail.rooms.map((room) => (
              <div
                key={room.id}
                class="grid grid-cols-[minmax(0,1fr)_6.5rem] items-baseline gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_9rem_6.5rem]"
                style="border-bottom:1px solid var(--ui-divider)"
              >
                <div class="min-w-0">
                  <p
                    class="m-0 text-[14px] font-bold"
                    style="letter-spacing:-0.012em"
                  >
                    {room.name}
                  </p>
                  <p
                    class="m-0 mt-0.5 text-[11px] tabular-nums"
                    style="color:var(--ui-text-muted)"
                  >
                    {room.beds} · sleeps {room.sleeps} ·{" "}
                    {formatCount(room.sizeSqft)} sq ft
                  </p>
                </div>
                <p
                  class="col-start-1 m-0 text-[11px] sm:col-start-2"
                  style="color:var(--ui-text-secondary)"
                >
                  {[
                    room.refundable ? "Refundable" : "Nonrefundable",
                    room.payLater ? "Pay later" : "Prepay",
                  ].join(" · ")}
                </p>
                <div class="col-start-2 sm:col-start-3 sm:text-right">
                  <p
                    class="m-0 text-[16px] font-bold tabular-nums"
                    style="letter-spacing:-0.03em;color:var(--ui-price)"
                  >
                    {formatUsd(room.nightly)}
                  </p>
                  <p
                    class="m-0 text-[10px] uppercase"
                    style="color:var(--ui-text-muted);letter-spacing:0.1em"
                  >
                    Per night
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div class="mt-6">
            <BureauLabel>Policies</BureauLabel>
            <p
              class="m-0 mt-2 max-w-[62ch] text-[12px]"
              style="color:var(--ui-text-secondary)"
            >
              {detail.cancellationBlurb}
            </p>
            <p
              class="m-0 mt-2 max-w-[62ch] text-[12px]"
              style="color:var(--ui-text-secondary)"
            >
              {detail.feesBlurb}
            </p>
          </div>
        </div>

        <div class="flex flex-col gap-5">
          <div>
            <BureauLabel>Facts</BureauLabel>
            <dl class="m-0 mt-1.5 grid grid-cols-[minmax(0,1fr)] gap-1.5 text-[12px]">
              {facts.map((fact) => (
                <div key={fact.label} class="grid gap-0.5">
                  <dt
                    class="text-[10px] uppercase"
                    style="color:var(--ui-text-muted);letter-spacing:0.12em"
                  >
                    {fact.label}
                  </dt>
                  <dd
                    class="m-0 tabular-nums"
                    style="color:var(--ui-text-secondary)"
                  >
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <BureauLabel>Amenities</BureauLabel>
            <ul class="m-0 mt-1.5 flex list-none flex-col gap-1 p-0 text-[12px]">
              {detail.amenities.map((amenity) => (
                <li key={amenity} style="color:var(--ui-text-secondary)">
                  {amenity}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
});
