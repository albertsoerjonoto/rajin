#!/usr/bin/env bash
# One-time secrets bootstrap. Reads ~/.config/rajin/secrets.env into the
# current shell and verifies each token via a one-line API call. Exits
# non-zero if any token is missing or invalid.
#
# Usage:
#   1. Create ~/.config/rajin/secrets.env with the keys listed below
#      (see .env.local.example for shape). chmod 600.
#   2. `source scripts/bootstrap-secrets.sh` from this repo's root.
#
# Tokens needed:
#   VERCEL_TOKEN              https://vercel.com/account/tokens
#   SUPABASE_ACCESS_TOKEN     https://supabase.com/dashboard/account/tokens
#   SUPABASE_SERVICE_ROLE_KEY (server/CI only) project Settings → API
#   SUPABASE_DB_PASSWORD      project Settings → Database
#
# After verification, also add each token as a GitHub Actions secret:
#   gh secret set VERCEL_TOKEN < <(echo "$VERCEL_TOKEN")
#   gh secret set SUPABASE_ACCESS_TOKEN < <(echo "$SUPABASE_ACCESS_TOKEN")
#   ...

set -euo pipefail

SECRETS_FILE="${HOME}/.config/rajin/secrets.env"

if [ ! -f "$SECRETS_FILE" ]; then
  cat <<EOF >&2
ERROR: $SECRETS_FILE not found.

Create it with:

  mkdir -p ~/.config/rajin
  chmod 700 ~/.config/rajin
  cat > $SECRETS_FILE <<'INNER'
VERCEL_TOKEN=<paste from https://vercel.com/account/tokens>
SUPABASE_ACCESS_TOKEN=<paste from https://supabase.com/dashboard/account/tokens>
SUPABASE_SERVICE_ROLE_KEY=<paste from project Settings → API>
SUPABASE_DB_PASSWORD=<paste from project Settings → Database>
INNER
  chmod 600 $SECRETS_FILE

Then re-run: source scripts/bootstrap-secrets.sh
EOF
  return 1 2>/dev/null || exit 1
fi

# shellcheck disable=SC1090
source "$SECRETS_FILE"

green() { printf '\033[32m✓\033[0m %s\n' "$1"; }
red() { printf '\033[31m✗\033[0m %s\n' "$1" >&2; }

failed=0

verify() {
  local name="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    green "$name verified"
  else
    red "$name FAILED"
    failed=1
  fi
}

# Vercel
if [ -n "${VERCEL_TOKEN:-}" ]; then
  verify "VERCEL_TOKEN" "npx -y vercel whoami --token \$VERCEL_TOKEN"
else
  red "VERCEL_TOKEN missing in $SECRETS_FILE"
  failed=1
fi

# Supabase
if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  verify "SUPABASE_ACCESS_TOKEN" "curl -fsS -H 'Authorization: Bearer \$SUPABASE_ACCESS_TOKEN' https://api.supabase.com/v1/projects"
else
  red "SUPABASE_ACCESS_TOKEN missing in $SECRETS_FILE"
  failed=1
fi

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  red "SUPABASE_SERVICE_ROLE_KEY missing (CI test seeding will not work)"
  failed=1
else
  green "SUPABASE_SERVICE_ROLE_KEY present"
fi

if [ "$failed" = "1" ]; then
  red "Bootstrap incomplete — fix the missing/invalid tokens above and re-run."
  return 1 2>/dev/null || exit 1
fi

green "All secrets verified. Now mirror to GitHub Actions:"
cat <<EOF
  gh secret set VERCEL_TOKEN -b "\$VERCEL_TOKEN"
  gh secret set VERCEL_ORG_ID -b "\$VERCEL_ORG_ID"
  gh secret set VERCEL_PROJECT_ID -b "\$VERCEL_PROJECT_ID"
  gh secret set SUPABASE_ACCESS_TOKEN -b "\$SUPABASE_ACCESS_TOKEN"
  gh secret set SUPABASE_SERVICE_ROLE_KEY -b "\$SUPABASE_SERVICE_ROLE_KEY"
  gh secret set NEXT_PUBLIC_SUPABASE_URL -b "\$NEXT_PUBLIC_SUPABASE_URL"
  gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY -b "\$NEXT_PUBLIC_SUPABASE_ANON_KEY"
EOF
