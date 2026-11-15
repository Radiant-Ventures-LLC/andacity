import assert from 'node:assert/strict'
import test from 'node:test'

const sourcesModule = await import('./inventorySources.ts')
const envModule = await import('~/lib/server/runtime-env.server')

const allSeed = { flight: 'seed', hotel: 'seed', car: 'seed' } as const
const liveFlights = { flight: 'duffel', hotel: 'seed', car: 'seed' } as const

test('seeded inventory is allowed outside production builds', () => {
  for (const nodeEnv of [undefined, 'development', 'test']) {
    assert.deepEqual(
      sourcesModule.findBlockedSeedVerticals({ nodeEnv, allowSeedInventory: undefined, sources: allSeed }),
      [],
    )
  }
})

test('production refuses every seeded vertical unless explicitly allowed', () => {
  assert.deepEqual(
    sourcesModule.findBlockedSeedVerticals({
      nodeEnv: 'production',
      allowSeedInventory: undefined,
      sources: liveFlights,
    }),
    ['hotel', 'car'],
  )
  assert.deepEqual(
    sourcesModule.findBlockedSeedVerticals({
      nodeEnv: 'production',
      allowSeedInventory: 'false',
      sources: allSeed,
    }),
    ['flight', 'hotel', 'car'],
  )
  assert.deepEqual(
    sourcesModule.findBlockedSeedVerticals({
      nodeEnv: 'production',
      allowSeedInventory: 'true',
      sources: allSeed,
    }),
    [],
  )
})

test('inventory sources follow the configured flight provider', () => {
  const env = (values: Record<string, string>) => ({ get: (key: string) => values[key] })
  try {
    envModule.initializeServerRuntimeEnv(env({}))
    assert.deepEqual(sourcesModule.getInventorySources(), allSeed)

    envModule.initializeServerRuntimeEnv(
      env({ ANDACITY_FLIGHT_PROVIDER: 'duffel', DUFFEL_ACCESS_TOKEN: 'duffel_test_abc' }),
    )
    assert.deepEqual(sourcesModule.getInventorySources(), liveFlights)
  } finally {
    envModule.initializeServerRuntimeEnv(env({}))
  }
})
