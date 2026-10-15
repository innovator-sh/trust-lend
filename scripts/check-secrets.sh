#!/usr/bin/env bash
# Secret check. Run before every push.
#
#   scripts/check-secrets.sh --worktree      scan tracked and untracked (not ignored) files
#   scripts/check-secrets.sh --range A..B    scan every commit in a range (used by the pre-push hook)
#   scripts/check-secrets.sh --head          scan the commit at HEAD
#
# Exit code 0 = clean, 1 = a possible secret was found.
# To allow a known-safe line, add the text "secrets-ok" to that line.
#
# Rule: never push keys, API keys or private keys. Use placeholders such as
# your_private_key_here in every committed file.

set -u

PATTERNS=(
  # Name = long value (the placeholder filter below removes your_*, <...>, process.env, and so on)
  '(PRIVATE_KEY|SECRET|API_KEY|APIKEY|ACCESS_TOKEN|AUTH_TOKEN|PASSWORD|MNEMONIC|SEED_PHRASE)[A-Za-z0-9_]*[[:space:]]*[=:][[:space:]]*["'\'']?[A-Za-z0-9+/_=-]{16,}'
  # A 64-character hex string (private key size)
  '(^|[^0-9A-Za-z])(0x)?[0-9a-fA-F]{64}($|[^0-9A-Za-z])'
  # Supabase keys and JWTs
  'sb_(publishable|secret)_[A-Za-z0-9_-]{10,}'
  'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.'
  # PEM private keys
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  # Common provider tokens
  'gh[pousr]_[A-Za-z0-9]{30,}'
  'AKIA[0-9A-Z]{16}'
  'sk-[A-Za-z0-9]{32,}'
  'AIza[0-9A-Za-z_-]{35}'
)

# Lines that contain these words are placeholders or code that reads a variable.
PLACEHOLDER='your_|<[a-z_ -]+>|placeholder|example|changeme|xxxx|process[.]env|import[.]meta|secrets-ok'

# Generated files with many hex hashes that are not secrets.
EXCLUDE=(
  ':!blockchain/artifacts'
  ':!src/contracts/*.json'
  ':!package-lock.json'
  ':!blockchain/package-lock.json'
  ':!scripts/check-secrets.sh'
)

found=0

report() { # report <label> <text>
  echo "  [$1] $2"
  found=1
}

scan_ref() { # scan_ref <tree-ish>
  local ref="$1" short
  short=$(git rev-parse --short "$ref" 2>/dev/null || echo "$ref")

  # 1. Env files (anything except .env.example)
  while IFS= read -r f; do
    case "$f" in
      *.env.example) ;;
      .env|*/.env|.env.*|*/.env.*|*.env) report "$short" "env file committed: $f" ;;
    esac
  done < <(git ls-tree -r --name-only "$ref")

  # 2. Secret patterns in file content
  local p out
  for p in "${PATTERNS[@]}"; do
    # git grep prints "ref:path:line:content". Test the placeholder words on the content only,
    # so a file name such as .env.example does not hide a real value.
    out=$(git grep -nIE -e "$p" "$ref" -- . "${EXCLUDE[@]}" 2>/dev/null       | awk -v re="$PLACEHOLDER" '{ c=$0; sub(/^[^:]*:[^:]*:[^:]*:/, "", c); if (c !~ re) print }' || true)
    if [ -n "$out" ]; then
      while IFS= read -r line; do
        # Hide the matched value; show file and line number only.
        report "$short" "$(echo "$line" | cut -d: -f2-3) possible secret (pattern: ${p:0:28}...)"
      done <<< "$out"
    fi
  done
}

scan_worktree() {
  local f p hits
  while IFS= read -r f; do
    case "$f" in
      *.env.example) continue ;;
      .env|*/.env|.env.*|*/.env.*)
        # Ignored files are not listed here, so a hit means git would track it.
        report "worktree" "env file not ignored: $f"; continue ;;
    esac
    case "$f" in
      blockchain/artifacts/*|src/contracts/*.json|package-lock.json|blockchain/package-lock.json|scripts/check-secrets.sh) continue ;;
    esac
    [ -f "$f" ] || continue
    for p in "${PATTERNS[@]}"; do
      hits=$(grep -nIE -e "$p" "$f" 2>/dev/null | grep -vE "$PLACEHOLDER" || true)
      if [ -n "$hits" ]; then
        while IFS= read -r line; do
          report "worktree" "$f:${line%%:*} possible secret (pattern: ${p:0:28}...)"
        done <<< "$hits"
      fi
    done
  done < <(git ls-files --cached --others --exclude-standard)
}

case "${1:-}" in
  --worktree) scan_worktree ;;
  --head)     scan_ref HEAD ;;
  --range)
    [ -n "${2:-}" ] || { echo "usage: $0 --range A..B"; exit 2; }
    for c in $(git rev-list "$2"); do scan_ref "$c"; done ;;
  *) echo "usage: $0 --worktree | --head | --range A..B"; exit 2 ;;
esac

if [ "$found" -ne 0 ]; then
  echo
  echo "SECRET CHECK FAILED. Remove the value, use a placeholder (for example your_private_key_here),"
  echo "and rotate the key if it was real. Do not push until this check passes."
  exit 1
fi
echo "Secret check passed."
