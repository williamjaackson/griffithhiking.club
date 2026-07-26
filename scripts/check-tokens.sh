#!/usr/bin/env bash
# Keeps the design system honest: raw values may only live in the token layer.
# Without this the codebase drifts back to the mockup's 80 bespoke clamps and
# scattered hex colours within a few months.
set -euo pipefail

TOKENS="src/styles/tokens.css"
status=0

report() {
  printf '\n%s\n' "$1"
  printf '%s\n' "$2" | sed 's/^/  /'
  status=1
}

# Hex colours. Anchored to 3, 4, 6 or 8 digits so URL fragments like #upcoming
# do not match. tokens.css is the one legitimate home for these.
hex=$(grep -rInE '#[0-9a-fA-F]{3,8}\b' src \
  --include='*.astro' --include='*.css' --include='*.ts' --include='*.tsx' |
  grep -v "^${TOKENS}:" || true)
if [ -n "$hex" ]; then
  report "Hex colours outside ${TOKENS}. Use a --color-* token or a tone variable:" "$hex"
fi

# Raw px font sizes, which bypass the fluid scale and ignore a reader's
# browser font-size setting.
px=$(grep -rInE 'font-size:[[:space:]]*[0-9.]+px' src \
  --include='*.astro' --include='*.css' |
  grep -v "^${TOKENS}:" || true)
if [ -n "$px" ]; then
  report "Raw px font sizes outside ${TOKENS}. Use a --text-* step:" "$px"
fi

if [ "$status" -eq 0 ]; then
  echo "token layer respected: no stray hex colours or px font sizes under src/"
fi
exit "$status"
