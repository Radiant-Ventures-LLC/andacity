import type { FlightSegmentSummary } from '~/types/flights/provider'
import type { FlightProviderRawOffer } from '../flightProviderClient.ts'
import type { DuffelOffer, DuffelOfferSegment, DuffelOfferSlice } from './duffelFlightTypes.ts'

// ---------------------------------------------------------------------------
// Inventory key
//
// Duffel offer ids are opaque and expire (~30 min), so they can't be the
// canonical inventory id. Instead the flight-number slot of the canonical id
// (`flight:{carrier}:{flightKey}:{departDate}:{origin}:{destination}`) holds a
// deterministic key built from the itinerary's segments:
//
//   one-way:     AA100BA200            (marketing carrier + flight number, per segment)
//   round-trip:  AA100BA200R20261215BA201AA101
//
// The `R{yyyymmdd}` separator carries the return date, which the canonical id
// has no slot for. It can't collide with segment text: an IATA carrier code
// always contains a letter and flight numbers are at most 4 digits, so "R"
// followed by 8 digits never appears inside a segment run.
// Resolving an id re-searches the route and picks the cheapest offer whose
// recomputed key matches.
// ---------------------------------------------------------------------------

const toAlnumUpper = (value: unknown) =>
  String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const segmentToken = (segment: DuffelOfferSegment) => {
  const carrier = toAlnumUpper(segment.marketing_carrier?.iata_code)
  const number = toAlnumUpper(segment.marketing_carrier_flight_number)
  return carrier && number ? `${carrier}${number}` : null
}

const sliceToken = (slice: DuffelOfferSlice | undefined) => {
  if (!slice || !Array.isArray(slice.segments) || slice.segments.length === 0) return null
  const tokens = slice.segments.map(segmentToken)
  if (tokens.some((token) => !token)) return null
  return tokens.join('')
}

export const buildDuffelFlightKey = (offer: DuffelOffer, returnDate: string | null) => {
  const outbound = sliceToken(offer.slices[0])
  if (!outbound) return null
  if (offer.slices.length === 1) return outbound
  if (offer.slices.length !== 2 || !returnDate) return null

  const inbound = sliceToken(offer.slices[1])
  const compactDate = returnDate.replace(/-/g, '')
  if (!inbound || !/^\d{8}$/.test(compactDate)) return null
  return `${outbound}R${compactDate}${inbound}`
}

export const readReturnDateFromFlightKey = (flightKey: string): string | null => {
  for (let index = flightKey.indexOf('R'); index >= 0; index = flightKey.indexOf('R', index + 1)) {
    const candidate = flightKey.slice(index + 1, index + 9)
    if (!/^\d{8}$/.test(candidate) || index === 0) continue
    const iso = `${candidate.slice(0, 4)}-${candidate.slice(4, 6)}-${candidate.slice(6, 8)}`
    const parsed = new Date(`${iso}T00:00:00Z`)
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(iso)) return iso
  }
  return null
}

// ---------------------------------------------------------------------------
// Time handling: Duffel segment times are airport-local without an offset.
// The rest of the app stores UTC instants, so convert using the airport zone.
// ---------------------------------------------------------------------------

const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/

const zoneOffsetMs = (utcMs: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'))
  return asUtc - utcMs
}

export const localTimeToUtcIso = (local: string | null | undefined, timeZone: string | null | undefined) => {
  const match = LOCAL_DATETIME.exec(String(local || ''))
  if (!match || !timeZone) return null
  const [, y, mo, d, h, mi, s] = match
  const wallMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0))
  try {
    let utcMs = wallMs - zoneOffsetMs(wallMs, timeZone)
    // Second pass settles instants near a DST transition.
    utcMs = wallMs - zoneOffsetMs(utcMs, timeZone)
    return new Date(utcMs).toISOString()
  } catch {
    return null
  }
}

const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+(?:\.\d+)?S)?)?$/

export const parseIsoDurationMinutes = (value: string | null | undefined) => {
  const match = ISO_DURATION.exec(String(value || ''))
  if (!match) return null
  const [, days, hours, minutes] = match
  return Number(days || 0) * 1440 + Number(hours || 0) * 60 + Number(minutes || 0)
}

const minutesBetween = (fromIso: string | null, toIso: string | null) => {
  if (!fromIso || !toIso) return null
  const diff = Date.parse(toIso) - Date.parse(fromIso)
  return Number.isFinite(diff) && diff >= 0 ? Math.round(diff / 60_000) : null
}

// ---------------------------------------------------------------------------
// Offer -> FlightProviderRawOffer
// ---------------------------------------------------------------------------

const toSegmentSummaries = (offer: DuffelOffer): FlightSegmentSummary[] => {
  const segments = offer.slices.flatMap((slice) => slice.segments)
  return segments.map((segment, index) => {
    const departureAt = localTimeToUtcIso(segment.departing_at, segment.origin?.time_zone)
    const arrivalAt = localTimeToUtcIso(segment.arriving_at, segment.destination?.time_zone)
    return {
      segmentOrder: index + 1,
      marketingCarrier: segment.marketing_carrier?.name || null,
      marketingCarrierCode: segment.marketing_carrier?.iata_code || null,
      operatingCarrier: segment.operating_carrier?.name || null,
      operatingCarrierCode: segment.operating_carrier?.iata_code || null,
      flightNumber: segment.marketing_carrier_flight_number || null,
      originCode: segment.origin?.iata_code || null,
      destinationCode: segment.destination?.iata_code || null,
      departureAt,
      arrivalAt,
      durationMinutes:
        parseIsoDurationMinutes(segment.duration) ?? minutesBetween(departureAt, arrivalAt),
    }
  })
}

const countCheckedBags = (segment: DuffelOfferSegment | undefined) => {
  const passenger = segment?.passengers?.[0]
  if (!passenger || !Array.isArray(passenger.baggages)) return null
  return passenger.baggages
    .filter((bag) => bag.type === 'checked')
    .reduce((total, bag) => total + Math.max(0, Number(bag.quantity) || 0), 0)
}

export type MapDuffelOfferContext = {
  departDate: string
  returnDate: string | null
  passengers: number
  snapshotTimestamp: string
}

export const mapDuffelOfferToRawOffer = (
  offer: DuffelOffer,
  context: MapDuffelOfferContext,
): FlightProviderRawOffer | null => {
  const outbound = offer.slices?.[0]
  const firstSegment = outbound?.segments?.[0]
  const lastOutboundSegment = outbound?.segments?.[outbound.segments.length - 1]
  if (!outbound || !firstSegment || !lastOutboundSegment) return null

  const flightKey = buildDuffelFlightKey(offer, context.returnDate)
  const airlineCode = offer.owner?.iata_code || firstSegment.marketing_carrier?.iata_code || null
  const originCode = outbound.origin?.iata_code || firstSegment.origin?.iata_code || null
  const destinationCode =
    outbound.destination?.iata_code || lastOutboundSegment.destination?.iata_code || null
  const totalAmount = Number(offer.total_amount)
  if (!flightKey || !airlineCode || !originCode || !destinationCode || !Number.isFinite(totalAmount)) {
    return null
  }

  const passengers = Math.max(1, Math.round(context.passengers) || 1)
  const departureAt = localTimeToUtcIso(firstSegment.departing_at, firstSegment.origin?.time_zone)
  const arrivalAt = localTimeToUtcIso(
    lastOutboundSegment.arriving_at,
    lastOutboundSegment.destination?.time_zone,
  )
  const segmentPassenger = firstSegment.passengers?.[0]

  return {
    itineraryId: 0,
    inventoryFlightKey: flightKey,
    providerOfferId: offer.id,
    providerOfferExpiresAt: offer.expires_at || null,
    airlineName: offer.owner?.name || firstSegment.marketing_carrier?.name || airlineCode,
    airlineCode,
    itineraryType: offer.slices.length === 2 ? 'round-trip' : 'one-way',
    serviceDate: context.departDate,
    requestedServiceDate: context.departDate,
    originCode,
    destinationCode,
    departureAt,
    arrivalAt,
    flightNumber: firstSegment.marketing_carrier_flight_number || null,
    stops: Math.max(0, outbound.segments.length - 1),
    durationMinutes:
      parseIsoDurationMinutes(outbound.duration) ?? minutesBetween(departureAt, arrivalAt) ?? 0,
    cabinClass: segmentPassenger?.cabin_class || null,
    fareCode: outbound.fare_brand_name || segmentPassenger?.fare_basis_code || null,
    // Prices are per traveller, matching the seeded provider.
    priceAmountCents: Math.round((totalAmount * 100) / passengers),
    currencyCode: String(offer.total_currency || '').toUpperCase(),
    refundable: offer.conditions?.refund_before_departure?.allowed ?? null,
    changeable: offer.conditions?.change_before_departure?.allowed ?? null,
    checkedBagsIncluded: countCheckedBags(firstSegment),
    seatsRemaining: null,
    freshnessTimestamp: context.snapshotTimestamp,
    segments: toSegmentSummaries(offer),
  }
}

/** Keep the cheapest offer per inventory key (Duffel returns one per fare brand). */
export const dedupeCheapestByKey = (offers: FlightProviderRawOffer[]) => {
  const byKey = new Map<string, FlightProviderRawOffer>()
  for (const offer of offers) {
    const key = offer.inventoryFlightKey || ''
    const existing = byKey.get(key)
    if (!existing || offer.priceAmountCents < existing.priceAmountCents) byKey.set(key, offer)
  }
  return [...byKey.values()].sort((a, b) => a.priceAmountCents - b.priceAmountCents)
}
