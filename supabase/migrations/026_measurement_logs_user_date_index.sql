-- measurement_logs is queried by (user_id, date) on every Dashboard,
-- Log, and Chat page mount, but the table only had a primary key index.
-- EXPLAIN ANALYZE confirmed Postgres was using Seq Scan + Filter — fine
-- now (small table) but linear in row count as users log more weight
-- entries. Composite index turns it into a single B-tree probe.

CREATE INDEX IF NOT EXISTS idx_measurement_logs_user_date
  ON public.measurement_logs (user_id, date);
