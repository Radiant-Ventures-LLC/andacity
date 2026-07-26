/**
 * CLAUDE-UI-053 — Ribbon preview scenario.
 *
 * DEV / DESIGN-PREVIEW ONLY. Assembles one half-planned trip out of the real
 * generated inventory and runs it through the production analyzers
 * (`tripGapAnalyzer`, `validateTripItineraryCoherence`) so every gap and warning
 * Ribbon draws is domain output, not preview copy.
 *
 * The trip is deliberately incomplete in the way real trips are: an outbound
 * flight with no return yet, a stay that stops a night short of the window, and
 * a car picked up two days after arrival. That produces genuine analyzer gaps
 * and — separately — a hole the rules do not catch, which is the more
 * interesting half of the argument for this direction.
 *
 * City ids stand in for database city ids. The analyzers only compare them for
 * equality, so stable local constants are sufficient here.
 */
import { CAR_RENTALS } from "~/data/car-rentals";
import { HOTELS } from "~/data/hotels";
import { addDays } from "~/lib/trips/date-utils";
import { tripGapAnalyzer } from "~/lib/trips/trip-gap-analyzer";
import { validateTripItineraryCoherence } from "~/lib/trips/itinerary-coherence";
import {
  generateFlightsForRoute,
  getFlightHorizonDates,
} from "~/seed/generators/generate-flights.js";
import type { RibbonItem } from "./ribbonModel";

type SeedFlight = {
  airline: string;
  origin: string;
  destination: string;
  stopsLabel: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  cabinClass: string;
  price: number;
  stops: number;
};

const ORIGIN_CITY_ID = 1;
const DESTINATION_CITY_ID = 2;
const ORIGIN_CITY_NAME = "San Francisco";
const DESTINATION_CITY_NAME = "Miami";

const horizon = getFlightHorizonDates() as string[];
const departDate = horizon.length ? horizon[0] : null;

/** Trip window runs four nights; the stay deliberately covers only three. */
const tripEndDate = departDate ? addDays(departDate, 4) : null;
const stayEndDate = departDate ? addDays(departDate, 3) : null;
const carStartDate = departDate ? addDays(departDate, 2) : null;

const flights = departDate
  ? (generateFlightsForRoute({
      fromSlug: "san-francisco",
      toSlug: "miami",
      departDate,
    }) as SeedFlight[])
  : [];

const outbound =
  [...flights].sort((a, b) => a.price - b.price).find((f) => f.stops === 0) ||
  flights[0] ||
  null;

const hotel =
  HOTELS.filter((h) => h.cityQuery === "miami").sort(
    (a, b) => a.fromNightly - b.fromNightly,
  )[0] || null;

const car =
  [...CAR_RENTALS]
    .filter((c) => c.cityQuery === "miami")
    .sort((a, b) => a.fromDaily - b.fromDaily)[0] || null;

export const RIBBON_TRIP = {
  name: "Miami, half planned",
  startDate: departDate,
  endDate: tripEndDate,
  travelers: 2,
} as const;

/** Shared shape feeding both the ribbon geometry and the two analyzers. */
type ScenarioItem = {
  id: number;
  itemType: "flight" | "hotel" | "car";
  position: number;
  title: string;
  detail: string;
  startDate: string | null;
  endDate: string | null;
  startCityId: number | null;
  endCityId: number | null;
  startCityName: string | null;
  endCityName: string | null;
  flightServiceDate: string | null;
  flightItineraryType: "one-way" | "round-trip" | null;
  carLocationType: "airport" | "city" | null;
};

const scenarioItems: ScenarioItem[] = [
  ...(outbound && departDate
    ? [
        {
          id: 1,
          itemType: "flight" as const,
          position: 0,
          title: `${outbound.airline} ${outbound.origin} → ${outbound.destination}`,
          detail: `${outbound.departureTime}–${outbound.arrivalTime} · ${outbound.stopsLabel} · ${outbound.duration}`,
          startDate: departDate,
          endDate: departDate,
          startCityId: ORIGIN_CITY_ID,
          endCityId: DESTINATION_CITY_ID,
          startCityName: ORIGIN_CITY_NAME,
          endCityName: DESTINATION_CITY_NAME,
          flightServiceDate: departDate,
          flightItineraryType: "one-way" as const,
          carLocationType: null,
        },
      ]
    : []),
  ...(hotel && departDate && stayEndDate
    ? [
        {
          id: 2,
          itemType: "hotel" as const,
          position: 1,
          title: hotel.name,
          detail: `${hotel.neighborhood} · 3 nights · $${hotel.fromNightly}/night`,
          startDate: departDate,
          endDate: stayEndDate,
          startCityId: DESTINATION_CITY_ID,
          endCityId: DESTINATION_CITY_ID,
          startCityName: DESTINATION_CITY_NAME,
          endCityName: DESTINATION_CITY_NAME,
          flightServiceDate: null,
          flightItineraryType: null,
          carLocationType: null,
        },
      ]
    : []),
  ...(car && carStartDate && tripEndDate
    ? [
        {
          id: 3,
          itemType: "car" as const,
          position: 2,
          title: car.name,
          detail: `${car.pickupArea} · 2 days · $${car.fromDaily}/day`,
          startDate: carStartDate,
          endDate: tripEndDate,
          startCityId: DESTINATION_CITY_ID,
          endCityId: DESTINATION_CITY_ID,
          startCityName: DESTINATION_CITY_NAME,
          endCityName: DESTINATION_CITY_NAME,
          flightServiceDate: null,
          flightItineraryType: null,
          carLocationType: "airport" as const,
        },
      ]
    : []),
];

export const RIBBON_ITEMS: RibbonItem[] = scenarioItems.map((item) => ({
  id: item.id,
  itemType: item.itemType,
  title: item.title,
  detail: item.detail,
  startDate: item.startDate,
  endDate: item.endDate,
}));

/**
 * `detail` is presentation-only, so the analyzers get an explicit projection
 * rather than a rest-spread — the analyzer input shape stays visible here.
 */
const toAnalyzerItem = (item: ScenarioItem) => ({
  id: item.id,
  itemType: item.itemType,
  position: item.position,
  title: item.title,
  startDate: item.startDate,
  endDate: item.endDate,
  startCityId: item.startCityId,
  endCityId: item.endCityId,
  startCityName: item.startCityName,
  endCityName: item.endCityName,
  flightServiceDate: item.flightServiceDate,
  flightItineraryType: item.flightItineraryType,
  carLocationType: item.carLocationType,
});

export const RIBBON_GAPS = tripGapAnalyzer({
  tripStartDate: RIBBON_TRIP.startDate,
  tripEndDate: RIBBON_TRIP.endDate,
  items: scenarioItems.map(toAnalyzerItem),
}).gaps;

export const RIBBON_ISSUES = validateTripItineraryCoherence({
  tripStartDate: RIBBON_TRIP.startDate,
  tripEndDate: RIBBON_TRIP.endDate,
  items: scenarioItems.map((item) => ({
    ...toAnalyzerItem(item),
    availabilityStatus: "valid" as const,
    liveFlightServiceDate: item.flightServiceDate,
    liveFlightDepartureAt: null,
    liveFlightArrivalAt: null,
    liveCarLocationType: item.carLocationType,
  })),
}).issues;
