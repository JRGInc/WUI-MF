#!/usr/bin/env bash
# Apply every migration to a throwaway Postgres container and run the RLS
# test files against it. Exits non-zero if any check prints FAIL.
# Migrations go into a template database; each test file then runs in its own
# fresh copy, so fixtures from one file can never skew another file's counts.
# Usage: supabase/tests/run-rls-tests.sh   (from the repo root; needs Docker)
set -euo pipefail
cd "$(dirname "$0")/../.."
NAME=wui-rls-test-$$
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=pw postgres:16-alpine >/dev/null
trap 'docker stop "$NAME" >/dev/null' EXIT
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 1
docker exec -i "$NAME" psql -U postgres -q -c "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;" -c "create database rls_template;"
P=(docker exec -i "$NAME" psql -U postgres -d rls_template -v ON_ERROR_STOP=1 -q)
"${P[@]}" < supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do "${P[@]}" < "$f" 2>&1 | grep -v NOTICE || true; done
"${P[@]}" -c "grant usage on schema public to anon, authenticated; grant all on all tables in schema public to anon, authenticated;"
status=0
i=0
for t in supabase/tests/*_rls.sql; do
  i=$((i + 1))
  docker exec "$NAME" psql -U postgres -q -c "create database rls_test_$i template rls_template;"
  echo "== $t"
  out=$(docker exec -i "$NAME" psql -U postgres -d "rls_test_$i" -q < "$t" 2>&1 | grep -E "PASS|FAIL" | sed 's/^NOTICE:  //')
  echo "$out"
  if grep -q FAIL <<<"$out"; then status=1; fi
done
exit $status
