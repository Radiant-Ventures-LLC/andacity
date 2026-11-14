import type { ProviderAdapter } from '~/lib/providers/providerAdapter'
import {
  flightProviderAdapter,
} from '~/lib/providers/flight/flightProviderAdapter'
import { FLIGHT_PROVIDER_REGISTRY_ALIAS } from '~/lib/providers/flight/constants'
import {
  duffelFlightProviderAdapter,
  getConfiguredFlightInventorySource,
} from '~/lib/providers/flight/duffel/duffelFlightProviderAdapter'
import {
  hotelProviderAdapter,
} from '~/lib/providers/hotel/hotelProviderAdapter'
import { HOTEL_PROVIDER_REGISTRY_ALIAS } from '~/lib/providers/hotel/constants'
import {
  carProviderAdapter,
} from '~/lib/providers/car/carProviderAdapter'
import { CAR_PROVIDER_REGISTRY_ALIAS } from '~/lib/providers/car/constants'

const createProviderAliasAdapter = (
  provider: string,
  target: ProviderAdapter | (() => ProviderAdapter),
): ProviderAdapter => {
  const pick = typeof target === 'function' ? target : () => target
  const adapter = pick()
  return createAliasFor(provider, adapter, pick)
}

const createAliasFor = (
  provider: string,
  initial: ProviderAdapter,
  pick: () => ProviderAdapter,
): ProviderAdapter => ({
  provider,
  vertical: initial.vertical,
  get aliasOf() {
    return pick().provider
  },
  search: (params, options) => pick().search(params, options),
  resolveInventory: (inventoryId, options) => pick().resolveInventory(inventoryId, options),
  fetchPrice: (inventoryId, options) => pick().fetchPrice(inventoryId, options),
  ...(initial.normalizeSearchResponse
    ? {
        normalizeSearchResponse: (response, params) =>
          pick().normalizeSearchResponse?.(response, params) || [],
      }
    : {}),
  ...(initial.normalizeInventoryResponse
    ? {
        normalizeInventoryResponse: (response, inventoryId) =>
          pick().normalizeInventoryResponse?.(response, inventoryId) || null,
      }
    : {}),
  ...(initial.normalizePriceResponse
    ? {
        normalizePriceResponse: (response, inventoryId) =>
          pick().normalizePriceResponse?.(response, inventoryId) || null,
      }
    : {}),
  ...(initial.resolveInventoryRecord
    ? {
        resolveInventoryRecord: (input, options) =>
          pick().resolveInventoryRecord?.(input, options) || Promise.resolve(null),
      }
    : {}),
})

// Seeded inventory stays the default; ANDACITY_FLIGHT_PROVIDER=duffel switches.
const seedFlightProviderAdapter: ProviderAdapter = {
  ...flightProviderAdapter,
  isEnabled: () => getConfiguredFlightInventorySource() === 'seed',
}

export const flightVerticalAdapter = createProviderAliasAdapter(
  FLIGHT_PROVIDER_REGISTRY_ALIAS,
  () =>
    getConfiguredFlightInventorySource() === 'duffel'
      ? duffelFlightProviderAdapter
      : seedFlightProviderAdapter,
)

export const hotelVerticalAdapter = createProviderAliasAdapter(
  HOTEL_PROVIDER_REGISTRY_ALIAS,
  hotelProviderAdapter,
)

export const carVerticalAdapter = createProviderAliasAdapter(
  CAR_PROVIDER_REGISTRY_ALIAS,
  carProviderAdapter,
)

export const DEFAULT_PROVIDER_ADAPTERS = [
  seedFlightProviderAdapter,
  duffelFlightProviderAdapter,
  flightVerticalAdapter,
  hotelProviderAdapter,
  hotelVerticalAdapter,
  carProviderAdapter,
  carVerticalAdapter,
] as const
