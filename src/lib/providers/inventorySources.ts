import { getServerRuntimeEnvValue } from '~/lib/server/runtime-env.server'
import { getConfiguredFlightInventorySource } from './flight/duffel/duffelFlightProviderAdapter.ts'

// ---------------------------------------------------------------------------
// Which inventory source serves each vertical, and whether seeded (synthetic)
// inventory may be served at all. See docs/adr/0002-retire-synthetic-inventory.md.
// ---------------------------------------------------------------------------

export type InventoryVertical = 'flight' | 'hotel' | 'car'
export type InventorySource = 'seed' | 'duffel'

export const getInventorySources = (): Record<InventoryVertical, InventorySource> => ({
  flight: getConfiguredFlightInventorySource(),
  // Hotels and cars move to Duffel when their adapters land (roadmap Phase 1).
  hotel: 'seed',
  car: 'seed',
})

const isTruthy = (value: unknown) =>
  ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase())

/**
 * Seeded inventory is fake: it must never reach real users. In a production
 * build it's refused unless the deployment opts in with
 * `ANDACITY_ALLOW_SEED_INVENTORY=true` (the private dev demo does, while hotels
 * and cars are still seeded). Returns the verticals that would be blocked.
 */
export const findBlockedSeedVerticals = (input: {
  nodeEnv: string | undefined
  allowSeedInventory: string | undefined
  sources: Record<InventoryVertical, InventorySource>
}): InventoryVertical[] => {
  if (input.nodeEnv !== 'production' || isTruthy(input.allowSeedInventory)) return []
  return (Object.keys(input.sources) as InventoryVertical[]).filter(
    (vertical) => input.sources[vertical] === 'seed',
  )
}

export const getBlockedSeedVerticals = () =>
  findBlockedSeedVerticals({
    nodeEnv: typeof process === 'undefined' ? undefined : process.env.NODE_ENV,
    allowSeedInventory: getServerRuntimeEnvValue('ANDACITY_ALLOW_SEED_INVENTORY'),
    sources: getInventorySources(),
  })
