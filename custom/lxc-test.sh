#!/usr/bin/env bash
# Starts the build from lxc-build.sh as a second, API-only Immich next to the stock instance: same database,
# same media, no background jobs. The stock instance keeps running untouched.
#
#   lxc-test.sh          start (or restart) on port 2284
#   lxc-test.sh stop     stop it again
set -euo pipefail

WORK=/opt/immich-custom
SRC=$WORK/src
DATA=$WORK/build-data
UNIT=immich-custom-test
PORT=${PORT:-2284}

systemctl stop "$UNIT" 2>/dev/null || true
systemctl reset-failed "$UNIT" 2>/dev/null || true
[[ "${1:-}" == stop ]] && exit 0

# the server looks for the web app, geodata and plugins in its build folder
mkdir -p "$DATA"
ln -sfn "$SRC/web/build" "$DATA/www"
ln -sfn /opt/immich/geodata "$DATA/geodata"
ln -sfn /opt/immich/app/plugins "$DATA/plugins"

# same environment as /opt/immich/app/bin/start.sh; helmet.json is the one the install patched for plain http
systemd-run --unit="$UNIT" --uid=immich --gid=immich -p WorkingDirectory="$SRC/server" \
  /usr/bin/bash -c "set -a; . /opt/immich/.env; set +a
    export IMMICH_PORT=$PORT IMMICH_WORKERS_INCLUDE=api IMMICH_BUILD_DATA=$DATA
    export IMMICH_HELMET_FILE=/opt/immich/app/helmet.json
    exec /usr/bin/node --no-warnings $SRC/server/dist/main.js"

echo "started $UNIT on port $PORT, logs: journalctl -u $UNIT -f"
