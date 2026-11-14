import assert from 'node:assert/strict'
import test from 'node:test'

import type { DuffelOffer } from './duffelFlightTypes.ts'

const httpModule: typeof import('../../duffel/duffelHttpClient.ts') = await import(
  new URL('../../duffel/duffelHttpClient.ts', import.meta.url).href
)
const mapModule: typeof import('./mapDuffelOffer.ts') = await import(
  new URL('./mapDuffelOffer.ts', import.meta.url).href
)
const clientModule: typeof import('./duffelFlightProviderClient.ts') = await import(
  new URL('./duffelFlightProviderClient.ts', import.meta.url).href
)
const adapterModule: typeof import('../flightProviderAdapter.ts') = await import(
  new URL('../flightProviderAdapter.ts', import.meta.url).href
)
const envModule: typeof import('../../../server/runtime-env.server.ts') = await import(
  new URL('../../../server/runtime-env.server.ts', import.meta.url).href
)
const registryModule: typeof import('../../providerRegistry.ts') = await import(
  new URL('../../providerRegistry.ts', import.meta.url).href
)

const { createDuffelHttpClient, DuffelApiError } = httpModule
const {
  buildDuffelFlightKey,
  readReturnDateFromFlightKey,
  localTimeToUtcIso,
  parseIsoDurationMinutes,
  mapDuffelOfferToRawOffer,
  dedupeCheapestByKey,
} = mapModule
const { createDuffelFlightProviderClient } = clientModule
const { createFlightProviderAdapter } = adapterModule

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const JFK = { iata_code: 'JFK', name: 'John F. Kennedy International', time_zone: 'America/New_York' }
const LHR = { iata_code: 'LHR', name: 'Heathrow', time_zone: 'Europe/London' }
const BOS = { iata_code: 'BOS', name: 'Logan International', time_zone: 'America/New_York' }
const AA = { name: 'American Airlines', iata_code: 'AA' }
const BA = { name: 'British Airways', iata_code: 'BA' }

const segment = (
  id: string,
  carrier: typeof AA,
  number: string,
  origin: typeof JFK,
  destination: typeof JFK,
  departingAt: string,
  arrivingAt: string,
  duration: string,
) => ({
  id,
  departing_at: departingAt,
  arriving_at: arrivingAt,
  duration,
  origin,
  destination,
  marketing_carrier: carrier,
  marketing_carrier_flight_number: number,
  operating_carrier: carrier,
  operating_carrier_flight_number: number,
  passengers: [
    {
      passenger_id: 'pas_1',
      cabin_class: 'economy' as const,
      fare_basis_code: 'Y26NR',
      baggages: [
        { type: 'checked' as const, quantity: 1 },
        { type: 'carry_on' as const, quantity: 1 },
      ],
    },
  ],
})

const buildOffer = (overrides: Partial<DuffelOffer> = {}): DuffelOffer => ({
  id: 'off_connecting',
  created_at: '2026-11-14T12:00:00Z',
  expires_at: '2026-11-14T12:30:00Z',
  live_mode: false,
  owner: BA,
  passengers: [{ id: 'pas_1', type: 'adult' }],
  total_amount: '612.40',
  total_currency: 'USD',
  tax_amount: '120.00',
  conditions: {
    refund_before_departure: { allowed: false, penalty_amount: null, penalty_currency: null },
    change_before_departure: { allowed: true, penalty_amount: '100.00', penalty_currency: 'USD' },
  },
  slices: [
    {
      id: 'sli_out',
      duration: 'PT9H5M',
      fare_brand_name: 'Basic',
      origin: BOS,
      destination: LHR,
      segments: [
        segment('seg_1', AA, '100', BOS, JFK, '2026-12-10T08:00:00', '2026-12-10T09:20:00', 'PT1H20M'),
        segment('seg_2', BA, '178', JFK, LHR, '2026-12-10T10:30:00', '2026-12-10T22:05:00', 'PT6H35M'),
      ],
    },
  ],
  ...overrides,
})

const directOffer = (amount: string, id = 'off_direct', brand = 'Basic'): DuffelOffer =>
  buildOffer({
    id,
    total_amount: amount,
    slices: [
      {
        id: `sli_${id}`,
        duration: 'PT6H55M',
        fare_brand_name: brand,
        origin: JFK,
        destination: LHR,
        segments: [
          segment(`seg_${id}`, BA, '112', JFK, LHR, '2026-12-10T18:30:00', '2026-12-11T06:25:00', 'PT6H55M'),
        ],
      },
    ],
  })

type RecordedCall = { url: string; init: RequestInit }

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })

const fakeFetch = (respond: (call: RecordedCall) => Response | Promise<Response>) => {
  const calls: RecordedCall[] = []
  const fetchImpl = async (url: string, init: RequestInit) => {
    const call = { url, init }
    calls.push(call)
    return respond(call)
  }
  return { calls, fetchImpl }
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

test('duffel http client sends v2 headers and wraps the body in data', async () => {
  const { calls, fetchImpl } = fakeFetch(() => jsonResponse(200, { data: { id: 'orq_1' } }))
  const http = createDuffelHttpClient({ accessToken: 'duffel_test_abc', fetch: fetchImpl })

  const result = await http.request<{ id: string }>({
    method: 'POST',
    path: '/air/offer_requests',
    query: { return_offers: true, supplier_timeout: 15000, ignored: undefined },
    data: { slices: [] },
  })

  assert.deepEqual(result, { id: 'orq_1' })
  assert.equal(http.isLiveMode, false)
  assert.equal(
    calls[0].url,
    'https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=15000',
  )
  const headers = calls[0].init.headers as Record<string, string>
  assert.equal(headers['Duffel-Version'], 'v2')
  assert.equal(headers.Authorization, 'Bearer duffel_test_abc')
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { data: { slices: [] } })
})

test('duffel http client maps API errors with status and request id', async () => {
  const { fetchImpl } = fakeFetch(() =>
    jsonResponse(
      422,
      { errors: [{ code: 'invalid_airport', title: 'Invalid', message: 'Airport XXX not found' }] },
      { 'x-request-id': 'req_123' },
    ),
  )
  const http = createDuffelHttpClient({ accessToken: 'duffel_test_abc', fetch: fetchImpl })

  await assert.rejects(
    http.request({ method: 'GET', path: '/air/airports/XXX' }),
    (error: unknown) => {
      assert.ok(error instanceof DuffelApiError)
      assert.equal(error.code, 'http')
      assert.equal(error.status, 422)
      assert.equal(error.requestId, 'req_123')
      assert.equal(error.errors[0].code, 'invalid_airport')
      assert.ok(!error.message.includes('duffel_test_abc'))
      return true
    },
  )
})

test('duffel http client refuses to call without a token and times out slow calls', async () => {
  const unconfigured = createDuffelHttpClient({ accessToken: '' })
  assert.equal(unconfigured.isConfigured, false)
  await assert.rejects(unconfigured.request({ method: 'GET', path: '/x' }), {
    code: 'not_configured',
  })

  const hanging = createDuffelHttpClient({
    accessToken: 'duffel_test_abc',
    timeoutMs: 20,
    fetch: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      }),
  })
  await assert.rejects(hanging.request({ method: 'GET', path: '/x' }), { code: 'timeout' })
})

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

test('flight keys encode every segment and round-trip return dates', () => {
  const oneWay = buildOffer()
  assert.equal(buildDuffelFlightKey(oneWay, null), 'AA100BA178')

  const roundTrip = buildOffer({
    slices: [
      ...buildOffer().slices,
      {
        id: 'sli_back',
        duration: 'PT7H40M',
        fare_brand_name: 'Basic',
        origin: LHR,
        destination: BOS,
        segments: [
          segment('seg_3', BA, '213', LHR, BOS, '2026-12-17T09:00:00', '2026-12-17T11:40:00', 'PT7H40M'),
        ],
      },
    ],
  })
  const key = buildDuffelFlightKey(roundTrip, '2026-12-17')
  assert.equal(key, 'AA100BA178R20261217BA213')
  assert.equal(readReturnDateFromFlightKey(key!), '2026-12-17')
  const mappedRoundTrip = mapDuffelOfferToRawOffer(roundTrip, {
    departDate: '2026-12-10',
    returnDate: '2026-12-17',
    passengers: 1,
    snapshotTimestamp: 'now',
  })
  assert.equal(mappedRoundTrip?.itineraryType, 'round-trip')
  assert.equal(mappedRoundTrip?.stops, 1)
  assert.equal(mappedRoundTrip?.destinationCode, 'LHR')
  assert.deepEqual(mappedRoundTrip?.segments.map((s) => s.sliceIndex), [0, 0, 1])
  assert.equal(readReturnDateFromFlightKey('AA100BA178'), null)
  // An "R" carrier code next to digits must not read as a return date.
  assert.equal(readReturnDateFromFlightKey('FR1234R31234'), null)
  // A round-trip offer without the return date can't be keyed.
  assert.equal(buildDuffelFlightKey(roundTrip, null), null)
})

test('local airport times convert to UTC instants across zones and DST', () => {
  assert.equal(localTimeToUtcIso('2026-12-10T08:00:00', 'America/New_York'), '2026-12-10T13:00:00.000Z')
  assert.equal(localTimeToUtcIso('2026-07-10T08:00:00', 'America/New_York'), '2026-07-10T12:00:00.000Z')
  assert.equal(localTimeToUtcIso('2026-12-10T22:05:00', 'Europe/London'), '2026-12-10T22:05:00.000Z')
  assert.equal(localTimeToUtcIso('2026-12-10T22:05:00', null), null)
  assert.equal(parseIsoDurationMinutes('PT9H5M'), 545)
  assert.equal(parseIsoDurationMinutes('P1DT2H'), 1560)
  assert.equal(parseIsoDurationMinutes('nonsense'), null)
})

test('offers map to the seeded raw offer shape with per-traveller prices', () => {
  const raw = mapDuffelOfferToRawOffer(buildOffer(), {
    departDate: '2026-12-10',
    returnDate: null,
    passengers: 2,
    snapshotTimestamp: '2026-11-14T12:00:01.000Z',
  })

  assert.ok(raw)
  assert.equal(raw.inventoryFlightKey, 'AA100BA178')
  assert.equal(raw.providerOfferId, 'off_connecting')
  assert.equal(raw.airlineCode, 'BA')
  assert.equal(raw.originCode, 'BOS')
  assert.equal(raw.destinationCode, 'LHR')
  assert.equal(raw.itineraryType, 'one-way')
  assert.equal(raw.stops, 1)
  assert.equal(raw.durationMinutes, 545)
  assert.equal(raw.priceAmountCents, 30620)
  assert.equal(raw.currencyCode, 'USD')
  assert.equal(raw.departureAt, '2026-12-10T13:00:00.000Z')
  assert.equal(raw.arrivalAt, '2026-12-10T22:05:00.000Z')
  assert.equal(raw.refundable, false)
  assert.equal(raw.changeable, true)
  assert.equal(raw.checkedBagsIncluded, 1)
  assert.equal(raw.fareCode, 'Basic')
  assert.deepEqual(
    raw.segments.map((s) => [s.segmentOrder, s.marketingCarrierCode, s.flightNumber, s.originCode]),
    [
      [1, 'AA', '100', 'BOS'],
      [2, 'BA', '178', 'JFK'],
    ],
  )
})

test('offers missing carrier codes are dropped and fare brands dedupe to the cheapest', () => {
  const broken = buildOffer()
  broken.slices[0].segments[0].marketing_carrier = { name: 'Mystery Air', iata_code: null }
  assert.equal(
    mapDuffelOfferToRawOffer(broken, {
      departDate: '2026-12-10',
      returnDate: null,
      passengers: 1,
      snapshotTimestamp: 'now',
    }),
    null,
  )

  const context = { departDate: '2026-12-10', returnDate: null, passengers: 1, snapshotTimestamp: 'now' }
  const deduped = dedupeCheapestByKey(
    [directOffer('480.00', 'off_flex', 'Flex'), directOffer('399.00', 'off_basic'), buildOffer()]
      .map((offer) => mapDuffelOfferToRawOffer(offer, context))
      .filter((offer): offer is NonNullable<typeof offer> => offer != null),
  )
  assert.deepEqual(
    deduped.map((offer) => [offer.inventoryFlightKey, offer.providerOfferId]),
    [
      ['BA112', 'off_basic'],
      ['AA100BA178', 'off_connecting'],
    ],
  )
})

// ---------------------------------------------------------------------------
// Adapter end to end (fake Duffel)
// ---------------------------------------------------------------------------

const buildAdapter = (offers: DuffelOffer[]) => {
  const { calls, fetchImpl } = fakeFetch(() =>
    jsonResponse(200, { data: { id: 'orq_1', live_mode: false, offers } }),
  )
  const http = createDuffelHttpClient({ accessToken: 'duffel_test_abc', fetch: fetchImpl })
  const client = createDuffelFlightProviderClient({ http })
  const adapter = createFlightProviderAdapter({ client, providerName: 'duffel' })
  return { calls, adapter }
}

test('duffel adapter search yields canonical entities that resolve back to the same offer', async () => {
  const { calls, adapter } = buildAdapter([buildOffer(), directOffer('399.00')])

  const results = await adapter.search({
    vertical: 'flight',
    origin: 'BOS',
    destination: 'LHR',
    departDate: '2026-12-10',
    passengers: 1,
  })

  assert.equal(results.length, 2)
  const connecting = results.find((entity) => entity.inventoryId.includes('AA100BA178'))
  assert.ok(connecting)
  assert.equal(connecting.inventoryId, 'flight:BA:AA100BA178:2026-12-10:BOS:LHR')
  assert.equal(
    (connecting.payload.providerMetadata as { providerName?: string } | null)?.providerName,
    'duffel',
  )
  assert.equal(connecting.price.amountCents, 61240)

  const body = JSON.parse(String(calls[0].init.body))
  assert.deepEqual(body.data.slices, [{ origin: 'BOS', destination: 'LHR', departure_date: '2026-12-10' }])
  assert.equal(body.data.passengers.length, 1)

  const resolved = await adapter.resolveInventory(connecting.inventoryId)
  assert.ok(resolved)
  assert.equal(resolved.inventoryId, connecting.inventoryId)
  assert.equal(resolved.vertical, 'flight')
  // Duffel doesn't report seat counts: unknown must stay unknown, not "0 seats left".
  assert.equal(resolved.payload.policy?.seatsRemaining, null)
  assert.equal(resolved.payload.policy?.checkedBagsIncluded, 1)

  const price = await adapter.fetchPrice(connecting.inventoryId)
  assert.deepEqual(price, { currency: 'USD', amount: 612.4 })

  // Search, resolve and price for the same route share one cached offer request.
  assert.equal(calls.length, 1)
})

test('duffel adapter returns null for itineraries that are no longer offered', async () => {
  const { adapter } = buildAdapter([directOffer('399.00')])
  assert.equal(await adapter.resolveInventory('flight:BA:AA100BA178:2026-12-10:BOS:LHR'), null)
})

test('duffel adapter search swallows supplier failures like the seeded provider', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse(500, { errors: [{ message: 'boom' }] }))
  const http = createDuffelHttpClient({ accessToken: 'duffel_test_abc', fetch: fetchImpl })
  const adapter = createFlightProviderAdapter({
    client: createDuffelFlightProviderClient({ http }),
    providerName: 'duffel',
  })
  const originalError = console.error
  console.error = () => {}
  try {
    const results = await adapter.search({
      vertical: 'flight',
      origin: 'BOS',
      destination: 'LHR',
      departDate: '2026-12-10',
    })
    assert.deepEqual(results, [])
  } finally {
    console.error = originalError
  }
})

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

test('flight search uses seeded inventory unless Duffel is configured', () => {
  const env = (values: Record<string, string>) => ({ get: (key: string) => values[key] })
  try {
    envModule.initializeServerRuntimeEnv(env({}))
    assert.deepEqual(
      registryModule.listSearchProviders('flight').map((p) => p.provider),
      ['flight-default'],
    )
    assert.equal(registryModule.getProvider('flight')?.aliasOf, 'flight-default')

    // Asking for Duffel without a token keeps the seed.
    envModule.initializeServerRuntimeEnv(env({ ANDACITY_FLIGHT_PROVIDER: 'duffel' }))
    assert.deepEqual(
      registryModule.listSearchProviders('flight').map((p) => p.provider),
      ['flight-default'],
    )

    envModule.initializeServerRuntimeEnv(
      env({ ANDACITY_FLIGHT_PROVIDER: 'duffel', DUFFEL_ACCESS_TOKEN: 'duffel_test_abc' }),
    )
    assert.deepEqual(
      registryModule.listSearchProviders('flight').map((p) => p.provider),
      ['duffel'],
    )
    assert.equal(registryModule.getProvider('flight')?.aliasOf, 'duffel')
    // Trip items saved against the seed still resolve through it by name.
    assert.ok(registryModule.getProvider('flight-default'))
  } finally {
    envModule.initializeServerRuntimeEnv(env({}))
  }
})
