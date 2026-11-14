// The subset of Duffel v2 flight types this integration reads.
// Reference: @duffel/api 4.31.0 OfferTypes.d.ts / OfferRequestsTypes.d.ts.

export type DuffelCabinClass = 'first' | 'business' | 'premium_economy' | 'economy'

export type DuffelAirline = {
  name: string
  iata_code: string | null
}

export type DuffelAirport = {
  iata_code: string | null
  name?: string
  time_zone: string | null
}

export type DuffelFlightsCondition = {
  allowed: boolean
  penalty_amount: string | null
  penalty_currency: string | null
} | null

export type DuffelSegmentPassenger = {
  passenger_id: string
  cabin_class: DuffelCabinClass
  cabin_class_marketing_name?: string | null
  fare_basis_code?: string | null
  baggages?: Array<{ type: 'checked' | 'carry_on'; quantity: number }>
}

export type DuffelOfferSegment = {
  id: string
  departing_at: string
  arriving_at: string
  duration: string | null
  origin: DuffelAirport
  destination: DuffelAirport
  marketing_carrier: DuffelAirline
  marketing_carrier_flight_number: string
  operating_carrier: DuffelAirline
  operating_carrier_flight_number: string | null
  passengers: DuffelSegmentPassenger[]
}

export type DuffelOfferSlice = {
  id: string
  duration: string | null
  fare_brand_name: string | null
  origin: DuffelAirport
  destination: DuffelAirport
  segments: DuffelOfferSegment[]
}

export type DuffelOffer = {
  id: string
  created_at: string
  expires_at: string
  live_mode: boolean
  owner: DuffelAirline
  passengers: Array<{ id: string; type: string | null }>
  slices: DuffelOfferSlice[]
  total_amount: string
  total_currency: string
  tax_amount: string | null
  conditions: {
    refund_before_departure: DuffelFlightsCondition
    change_before_departure: DuffelFlightsCondition
  }
}

export type DuffelOfferRequest = {
  id: string
  live_mode: boolean
  offers: DuffelOffer[]
}

export type DuffelCreateOfferRequest = {
  slices: Array<{ origin: string; destination: string; departure_date: string }>
  passengers: Array<{ type: 'adult' }>
  cabin_class?: DuffelCabinClass
  max_connections?: 0 | 1 | 2
}
