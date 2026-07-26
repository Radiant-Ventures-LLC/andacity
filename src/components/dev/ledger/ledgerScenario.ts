/**
 * CLAUDE-UI-052 — Ledger preview scenario.
 *
 * DEV / DESIGN-PREVIEW ONLY. Resolves one concrete trip out of the real
 * generated inventory — San Francisco to Miami, four nights — so the roll-up
 * adds up actual flight, stay, and car records rather than illustrative numbers.
 *
 * The dates come from `getFlightHorizonDates()` rather than a hardcoded label,
 * because the seeded flight horizon is anchored to the current date: a fixed
 * label would drift out of the window and quietly describe a trip the inventory
 * cannot price.
 *
 * Selection runs once at module scope; the generators are seeded and
 * deterministic, so there is no reason to re-derive this per request.
 */
import { CAR_RENTALS, type CarRental } from "~/data/car-rentals";
import { HOTELS, type Hotel } from "~/data/hotels";
import {
  generateFlightsForRoute,
  getFlightHorizonDates,
} from "~/seed/generators/generate-flights.js";

export type ScenarioFlight = {
  airline: string;
  origin: string;
  destination: string;
  stopsLabel: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  cabinClass: string;
  price: number;
  currency: string;
};

type SeedFlight = ScenarioFlight & { stops: number };

const NIGHTS = 4;
const TRAVELERS = 2;

const horizon = getFlightHorizonDates() as string[];
const departDate = horizon.length ? horizon[0] : null;
const returnDate =
  horizon.length > NIGHTS ? horizon[NIGHTS] : (horizon.at(-1) ?? null);

const formatDay = (iso: string | null, withMonth: boolean) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
        timeZone: "UTC",
        day: "numeric",
        ...(withMonth ? { month: "long" } : {}),
      })
    : "";

/** "25–29 July" when the stay sits inside one month, otherwise both months. */
const buildDateLabel = () => {
  if (!departDate || !returnDate) return "dates unavailable";

  const sameMonth = departDate.slice(0, 7) === returnDate.slice(0, 7);
  return `${formatDay(departDate, !sameMonth)}–${formatDay(returnDate, true)}`;
};

export const LEDGER_TRIP = {
  cityQuery: "miami",
  cityLabel: "Miami",
  originCityQuery: "san-francisco",
  departDate,
  returnDate,
  dateLabel: buildDateLabel(),
  nights: NIGHTS,
  carDays: NIGHTS,
  travelers: TRAVELERS,
} as const;

/**
 * Prefer a nonstop economy itinerary — the fare a traveler would actually
 * compare against — and fall back to the cheapest option on the route.
 */
const pickFlight = (flights: SeedFlight[]): ScenarioFlight | null => {
  if (!flights.length) return null;

  const byPrice = [...flights].sort((a, b) => a.price - b.price);
  return (
    byPrice.find((f) => f.stops === 0 && f.cabinClass === "economy") ||
    byPrice.find((f) => f.stops === 0) ||
    byPrice[0]
  );
};

// Takes { fromSlug, toSlug }, not a route object — passing a route silently
// falls back to the generator's default city pair.
export const LEDGER_FLIGHT: ScenarioFlight | null = pickFlight(
  generateFlightsForRoute({
    fromSlug: LEDGER_TRIP.originCityQuery,
    toSlug: LEDGER_TRIP.cityQuery,
    ...(departDate ? { departDate } : {}),
  }) as SeedFlight[],
);

export const LEDGER_HOTELS: Hotel[] = HOTELS.filter(
  (hotel) => hotel.cityQuery === LEDGER_TRIP.cityQuery,
);

/** Cheapest daily rate in the city, so the roll-up reflects a real low-end pick. */
export const LEDGER_CAR: CarRental | null =
  [...CAR_RENTALS]
    .filter((car) => car.cityQuery === LEDGER_TRIP.cityQuery)
    .sort((a, b) => a.fromDaily - b.fromDaily)[0] || null;
