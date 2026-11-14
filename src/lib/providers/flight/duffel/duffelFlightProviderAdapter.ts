import { createDuffelHttpClient, type DuffelHttpClient } from '~/lib/providers/duffel/duffelHttpClient'
import { getServerRuntimeEnvValue } from '~/lib/server/runtime-env.server'
import type { FlightProviderClient } from '../flightProviderClient.ts'
import { createFlightProviderAdapter } from '../flightProviderAdapter.ts'
import {
  createDuffelFlightProviderClient,
  DUFFEL_FLIGHT_PROVIDER_NAME,
} from './duffelFlightProviderClient.ts'

export type FlightInventorySource = 'seed' | 'duffel'

/** `ANDACITY_FLIGHT_PROVIDER=duffel` (with a token) switches flight inventory to Duffel. */
export const getConfiguredFlightInventorySource = (): FlightInventorySource => {
  const requested = String(getServerRuntimeEnvValue('ANDACITY_FLIGHT_PROVIDER') || '')
    .trim()
    .toLowerCase()
  if (requested !== 'duffel') return 'seed'
  return getServerRuntimeEnvValue('DUFFEL_ACCESS_TOKEN') ? 'duffel' : 'seed'
}

// The token is read when the first request is made, not at import time, so the
// runtime env (initialized per request platform) is in place.
const createLazyDuffelClient = (): FlightProviderClient => {
  let cached: { token: string; client: FlightProviderClient } | null = null
  const current = () => {
    const token = String(getServerRuntimeEnvValue('DUFFEL_ACCESS_TOKEN') || '')
    if (!cached || cached.token !== token) {
      const http: DuffelHttpClient = createDuffelHttpClient({
        accessToken: token,
        apiBase: getServerRuntimeEnvValue('DUFFEL_API_BASE'),
      })
      cached = { token, client: createDuffelFlightProviderClient({ http }) }
    }
    return cached.client
  }

  return {
    search: (request, options) => current().search(request, options),
    resolveInventory: (lookup, options) => current().resolveInventory(lookup, options),
    fetchPrice: (lookup, options) => current().fetchPrice(lookup, options),
  }
}

export const duffelFlightProviderAdapter = {
  ...createFlightProviderAdapter({
    client: createLazyDuffelClient(),
    providerName: DUFFEL_FLIGHT_PROVIDER_NAME,
  }),
  isEnabled: () => getConfiguredFlightInventorySource() === 'duffel',
}
