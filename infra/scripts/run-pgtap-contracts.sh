#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
test_files=("${repo_root}"/infra/supabase/tests/database/*.test.sql)

if [[ ${#test_files[@]} -eq 0 ]]; then
  echo "No pgTAP contract files found under infra/supabase/tests/database." >&2
  exit 1
fi

if ! output="$(supabase test db "${test_files[@]}" --local --workdir "${repo_root}/infra" 2>&1)"; then
  printf '%s\n' "${output}"
  exit 1
fi

printf '%s\n' "${output}"

if grep -q "Result: NOTESTS" <<<"${output}" || ! grep -Eq "Files=[1-9][0-9]*, Tests=[1-9][0-9]*," <<<"${output}"; then
  echo "pgTAP contract command completed without executing tests." >&2
  exit 1
fi
