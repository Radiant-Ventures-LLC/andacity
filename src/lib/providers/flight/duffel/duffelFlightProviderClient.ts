import type { ProviderRequestOptions } from '~/lib/providers/providerAdapter'
import { DuffelApiError, type DuffelHttpClient } from '~/lib/providers/duffel/duffelHttpClient'
import {
  FlightProviderClientError,
  type FlightProviderClient,
  type FlightProviderInventoryLookup,
  type FlightProviderRawOffer,
} from '../flightProviderClient.ts'
import type { FlightProviderSearchRequest } from '../mapFlightSearchParams.ts'
import type { DuffelCreateOfferRequest, DuffelOfferRequest } from './duffelFlightTypes.ts'
import {
  dedupeCheapestByKey,
  mapDuffelOfferToRawOffer,
  readReturnDateFromFlightKey,
} from './mapDuffelOffer.ts'

export const DUFFEL_FLIGHT_PROVIDER_NAME = 'duffel'

const MAX_RESULTS = 50
const SUPPLIER_TIMEOUT_MS = 15_000
const REQUEST_TIMEOUT_MS = 25_000
const CACHE_TTL_MS = 5 * 60_000
const CACHE_MAX_ENTRIES = 200

type SearchKey = {
  origin: string
  destination: string
  departDate: string
  returnDate: string | null
  passengers: number
}

type CacheEntry = { expiresAt: number; offers: FlightProviderRawOffer[] }

export type DuffelFlightProviderClientOptions = {
  http: DuffelHttpClient
  now?: () => number
  maxConnections?: 0 | 1 | 2
}

const cacheKeyOf = (key: SearchKey) =>
  [key.origin, key.destination, key.departDate, key.returnDate || '-', key.passengers].join('|')

const toClientError = (operation: string, error: unknown) => {
  if (error instanceof FlightProviderClientError) return error
  if (error instanceof DuffelApiError) {
    const code = error.code === 'timeout' ? 'timeout' : error.code === 'aborted' ? 'aborted' : 'provider_failure'
    // Log the supplier detail server-side; callers only see the coarse code.
    console.error(`[duffel] ${operation} failed`, {
      code: error.code,
      status: error.status,
      requestId: error.requestId,
      errors: error.errors,
    })
    return new FlightProviderClientError(code, `Duffel ${operation} failed.`, { cause: error })
  }
  return new FlightProviderClientError('provider_failure', `Duffel ${operation} failed.`, {
    cause: error,
  })
}

export const createDuffelFlightProviderClient = (
  options: DuffelFlightProviderClientOptions,
): FlightProviderClient & { clearCache(): void } => {
  const { http } = options
  const now = options.now || (() => Date.now())
  const cache = new Map<string, CacheEntry>()

  const searchOffers = async (key: SearchKey, requestOptions?: ProviderRequestOptions) => {
    const cacheKey = cacheKeyOf(key)
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > now()) return cached.offers

    const body: DuffelCreateOfferRequest = {
      slices: [
        { origin: key.origin, destination: key.destination, departure_date: key.departDate },
        ...(key.returnDate
          ? [{ origin: key.destination, destination: key.origin, departure_date: key.returnDate }]
          : []),
      ],
      passengers: Array.from({ length: key.passengers }, () => ({ type: 'adult' as const })),
      cabin_class: 'economy',
      max_connections: options.maxConnections ?? 1,
    }

    const offerRequest = await http.request<DuffelOfferRequest>({
      method: 'POST',
      path: '/air/offer_requests',
      query: { return_offers: true, supplier_timeout: SUPPLIER_TIMEOUT_MS },
      data: body,
      signal: requestOptions?.signal,
      timeoutMs: REQUEST_TIMEOUT_MS,
    })

    const snapshotTimestamp = new Date(now()).toISOString()
    const mapped = (offerRequest.offers || [])
      .map((offer) =>
        mapDuffelOfferToRawOffer(offer, {
          departDate: key.departDate,
          returnDate: key.returnDate,
          passengers: key.passengers,
          snapshotTimestamp,
        }),
      )
      .filter((offer): offer is FlightProviderRawOffer => offer != null)
    const offers = dedupeCheapestByKey(mapped).slice(0, MAX_RESULTS)

    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(cacheKey, { expiresAt: now() + CACHE_TTL_MS, offers })
    return offers
  }

  const findOfferForLookup = async (
    lookup: FlightProviderInventoryLookup,
    requestOptions?: ProviderRequestOptions,
  ) => {
    const { parsedInventory } = lookup
    const offers = await searchOffers(
      {
        origin: parsedInventory.originCode,
        destination: parsedInventory.destinationCode,
        departDate: parsedInventory.departDate,
        returnDate: readReturnDateFromFlightKey(parsedInventory.flightNumber),
        passengers: 1,
      },
      requestOptions,
    )
    return offers.find((offer) => offer.inventoryFlightKey === parsedInventory.flightNumber) || null
  }

  return {
    clearCache() {
      cache.clear()
    },

    async search(request: FlightProviderSearchRequest, requestOptions) {
      if (!request.departDate) {
        return { provider: DUFFEL_FLIGHT_PROVIDER_NAME, request, results: [] }
      }
      try {
        const results = await searchOffers(
          {
            origin: request.originIata,
            destination: request.destinationIata,
            departDate: request.departDate,
            returnDate: request.itineraryType === 'round-trip' ? request.returnDate : null,
            passengers: request.passengers,
          },
          requestOptions,
        )
        return { provider: DUFFEL_FLIGHT_PROVIDER_NAME, request, results }
      } catch (error) {
        throw toClientError('search', error)
      }
    },

    async resolveInventory(lookup, requestOptions) {
      try {
        return await findOfferForLookup(lookup, requestOptions)
      } catch (error) {
        throw toClientError('resolveInventory', error)
      }
    },

    async fetchPrice(lookup, requestOptions) {
      try {
        const offer = await findOfferForLookup(lookup, requestOptions)
        if (!offer) return null
        return {
          provider: DUFFEL_FLIGHT_PROVIDER_NAME,
          itineraryId: offer.itineraryId,
          currencyCode: offer.currencyCode,
          priceAmountCents: offer.priceAmountCents,
          refundable: offer.refundable,
          changeable: offer.changeable,
          checkedBagsIncluded: offer.checkedBagsIncluded,
          seatsRemaining: offer.seatsRemaining,
        }
      } catch (error) {
        throw toClientError('fetchPrice', error)
      }
    },
  }
}
