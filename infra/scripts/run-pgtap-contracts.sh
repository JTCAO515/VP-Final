#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
test_dir="${repo_root}/infra/supabase/tests/database"

if ! compgen -G "${test_dir}/*.test.sql" >/dev/null; then
  echo "No pgTAP contract files found under infra/supabase/tests/database." >&2
  exit 1
fi

# Supabase CLI discovers its standard test directory from --workdir. Passing individual SQL paths
# makes the current CLI treat them as an unsupported source and can leave CI's contract gate stuck.
if ! output="$(supabase test db --local --workdir "${repo_root}/infra" 2>&1)"; then
  printf '%s\n' "${output}"
  exit 1
fi

printf '%s\n' "${output}"

if grep -q "Result: NOTESTS" <<<"${output}" || ! grep -Eq "Files=[1-9][0-9]*, Tests=[1-9][0-9]*," <<<"${output}"; then
  echo "pgTAP contract command completed without executing tests." >&2
  exit 1
fi
