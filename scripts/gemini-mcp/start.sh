#!/usr/bin/env bash
# Wrapper that sources secrets from outside the repo, aliases Notion token,
# and launches the Gemini MCP server. Called by .mcp.json.
set -e

ENV_FILE="${ENV_FILE:-/Users/odotjdot/APPS/.env.fmos.local}"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE — cannot start gemini-mcp" >&2; exit 1; }

# Read just the keys we need and export them. Avoids `source <(...)` quirks
# and avoids polluting env with the rest of the shared secrets file.
while IFS='=' read -r key value; do
  [ -n "$key" ] && export "$key=$value"
done < <(grep -E '^(GEMINI_API_KEY|NOTION_TOKEN_GEMINI|NOTION_TOKEN)=' "$ENV_FILE")

# Alias gemini-scoped Notion token to the generic name the server expects
[ -z "${NOTION_TOKEN:-}" ] && [ -n "${NOTION_TOKEN_GEMINI:-}" ] && export NOTION_TOKEN="$NOTION_TOKEN_GEMINI"

[ -z "${GEMINI_API_KEY:-}" ] && { echo "GEMINI_API_KEY not set in $ENV_FILE" >&2; exit 1; }

DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$DIR/server.mjs"
