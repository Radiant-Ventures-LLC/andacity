# Project Instructions

## Database Commands

The `DATABASE_URL` in `/home/alden/a/andacity/.env.development` points at the retired AWS RDS instance (`database-1…us-east-2.rds.amazonaws.com`). It no longer resolves, so don't use it for any Postgres, migration, seed, or database-validation command.

- **dev.andacity.com database:** Postgres 17 runs inside the compose stack on the `andacity-dev` OCI VM (`ssh andacity-dev`, stack in `/opt/andacity/src`). Run DB commands through the compose `tools` service there, e.g.
  `docker compose -f deploy/dev/docker-compose.yml --env-file /opt/andacity/dev.env run --rm tools pnpm db:migrate`,
  or use `deploy/dev/redeploy.sh --migrate` / `--seed`. Reseeding takes about an hour and replaces the demo data, so confirm with the user before running it.
- **Local database:** none is configured right now. Ask the user which database to use before running DB commands locally.

Do not assume or hardcode a localhost Postgres connection string unless the user explicitly instructs you to do so.
