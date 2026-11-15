import type { RequestHandler } from '@builder.io/qwik-city'
import { getBlockedSeedVerticals } from '~/lib/providers/inventorySources'
import { initializeServerRuntimeEnv } from '~/lib/server/runtime-env.server'

let reportedBlock = ''

export const onRequest: RequestHandler = ({ env, error }) => {
  initializeServerRuntimeEnv(env)

  // Fail closed: a production deployment must never serve synthetic inventory.
  const blocked = getBlockedSeedVerticals()
  if (blocked.length) {
    const summary = blocked.join(', ')
    if (reportedBlock !== summary) {
      reportedBlock = summary
      console.error(
        `[inventory] refusing requests: seeded inventory configured for ${summary} in production. ` +
          'Configure a supplier for each vertical, or set ANDACITY_ALLOW_SEED_INVENTORY=true for a private demo.',
      )
    }
    throw error(503, 'Service temporarily unavailable')
  }
}
