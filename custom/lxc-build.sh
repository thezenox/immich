#!/usr/bin/env bash
# Builds the patched Immich server and web app in a community-scripts LXC, next to the stock install.
# The stock source in /opt/immich/source (installed dependencies included) is copied, so nothing of the
# running instance changes.
#
#   lxc-build.sh <patch.tar>    tarball from custom/pack.sh
#   FORCE=1 lxc-build.sh ...    build even if the patch was made for another Immich version
set -euo pipefail

STOCK_SRC=/opt/immich/source
WORK=/opt/immich-custom
SRC=$WORK/src
PATCH=${1:?usage: lxc-build.sh <patch.tar>}

STOCK_VERSION=v$(jq -r .version "$STOCK_SRC/package.json")
BASE=$(tar -xOf "$PATCH" custom-base.txt 2>/dev/null || true)
if [[ -n "$BASE" && "$BASE" != "$STOCK_VERSION" && "${FORCE:-}" != 1 ]]; then
  echo "the patch is made for $BASE, but Immich $STOCK_VERSION is installed: use a matching patch (or FORCE=1)" >&2
  exit 1
fi

echo "== copying stock source $STOCK_VERSION"
rm -rf "$SRC"
mkdir -p "$WORK"
cp -a "$STOCK_SRC" "$SRC"

echo "== applying patch"
tar -xf "$PATCH" -C "$SRC" --exclude custom-base.txt
# tarballs packed by hand on Windows may carry CRLF line endings
tar -tf "$PATCH" --exclude custom-base.txt | grep -v '/$' | (cd "$SRC" && xargs -d '\n' sed -i 's/\r$//')

cd "$SRC"
echo "== building server"
nice -n 19 pnpm --filter @immich/sdk --filter @immich/plugin-sdk --filter immich build
echo "== building web"
nice -n 19 pnpm --filter @immich/sdk --filter immich-web build

echo "== done: server $SRC/server/dist, web $SRC/web/build"
