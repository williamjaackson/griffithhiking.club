#!/usr/bin/env bash
# Activates an uploaded release on the VPS. Piped to the server over stdin by
# .github/workflows/deploy.yml and run as the unprivileged `deploy` user.
#
# Expects in the environment:
#   SITE_ROOT  e.g. /srv/www/griffithhiking.club
#   RELEASE    directory name under $SITE_ROOT/releases
#   KEEP       how many releases to retain
set -euo pipefail

: "${SITE_ROOT:?SITE_ROOT must be set}"
: "${RELEASE:?RELEASE must be set}"
: "${KEEP:?KEEP must be set}"

TARGET="$SITE_ROOT/releases/$RELEASE"

# Refuse to point the document root at something that isn't a built site.
test -f "$TARGET/index.html" || {
  echo "no index.html in $TARGET - refusing to activate" >&2
  exit 1
}

# ln then `mv -T` replaces the symlink atomically, so no request ever sees a
# missing or half-swapped document root.
ln -sfn "$TARGET" "$SITE_ROOT/current.tmp"
mv -Tf "$SITE_ROOT/current.tmp" "$SITE_ROOT/current"
echo "current -> $(readlink "$SITE_ROOT/current")"

# Retain the most recent releases so rolling back is just a relink.
ls -1dt "$SITE_ROOT"/releases/*/ | tail -n "+$((KEEP + 1))" | xargs -r rm -rf
echo "releases retained: $(ls -1d "$SITE_ROOT"/releases/*/ | wc -l | tr -d ' ')"
