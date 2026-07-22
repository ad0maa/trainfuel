-- SPEC.md §4.4: local Food search via Postgres trigram similarity.
-- Enabling the extension and adding the GIN trigram index as raw SQL rather
-- than via Prisma's `postgresqlExtensions` preview feature — see
-- DECISIONS.md ("Search: pg_trgm approach") for why.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Food_name_trgm_idx" ON "Food" USING GIN ("name" gin_trgm_ops);
