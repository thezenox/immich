#!/usr/bin/env bash
# Puts the build from lxc-build.sh into the running community-scripts install and restarts Immich, or puts the
# stock files back. Only the files the patch changes are replaced: the server files the custom build compiles
# differently than the stock source, and the web app. The stock originals are kept for restoring.
#
#   lxc-deploy.sh            deploy the custom build
#   lxc-deploy.sh check      only show what would be replaced
#   lxc-deploy.sh restore    back to the stock files
#
# The community-scripts `update` replaces the whole install, so after an Immich update the patch is gone until
# a matching build is deployed again.
set -euo pipefail

APP=/opt/immich/app
STOCK=/opt/immich/source
SRC=/opt/immich-custom/src
VERSION=$(jq -r .version "$APP/package.json")
BACKUP=/opt/immich-custom/stock-$VERSION
MODE=${1:-deploy}

restart() {
  systemctl restart immich-web
  echo "== restarted immich-web: $1"
}

if [[ "$MODE" == restore ]]; then
  if [[ ! -f "$BACKUP/files.txt" ]]; then
    echo "no backup of the stock files of $VERSION in $BACKUP" >&2
    exit 1
  fi
  while read -r file; do
    if [[ -e "$BACKUP/dist/$file" ]]; then
      cp -a "$BACKUP/dist/$file" "$APP/dist/$file"
    else
      rm -f "$APP/dist/$file"
      rmdir -p --ignore-fail-on-non-empty "$(dirname "$APP/dist/$file")"
    fi
  done <"$BACKUP/files.txt"
  rm -rf "$APP/www"
  cp -a "$BACKUP/www" "$APP/www"
  restart "stock files of $VERSION restored"
  exit 0
fi

for dir in "$STOCK" "$SRC"; do
  if [[ "$(jq -r .version "$dir/package.json")" != "$VERSION" ]]; then
    echo "$dir is not Immich $VERSION, run the community-scripts update or lxc-build.sh first" >&2
    exit 1
  fi
done

echo "== comparing the custom build with the stock build"
mapfile -t FILES < <(
  cd "$SRC/server/dist" &&
    find . -type f \( -name '*.js' -o -name '*.js.map' \) -printf '%P\n' |
    while read -r file; do cmp -s "$file" "$STOCK/server/dist/$file" || echo "$file"; done
)
if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "the custom build does not differ from the stock build" >&2
  exit 1
fi
printf '   %s\n' "${FILES[@]}"

# the installer patches a few files after building; such files must not be replaced, their patch would be lost
backed_up() { [[ -f "$BACKUP/files.txt" ]] && grep -qxF "$1" "$BACKUP/files.txt"; }
for file in "${FILES[@]}"; do
  if ! backed_up "$file" && [[ -e "$APP/dist/$file" ]] && ! cmp -s "$APP/dist/$file" "$STOCK/server/dist/$file"; then
    echo "$APP/dist/$file was changed by the installer, not replacing it" >&2
    exit 1
  fi
done
if [[ ! -d "$BACKUP/www" ]] && ! diff -rq "$APP/www" "$STOCK/web/build" >/dev/null; then
  echo "$APP/www differs from the stock web build, not replacing it" >&2
  exit 1
fi

if [[ "$MODE" == check ]]; then
  echo "== check passed, lxc-deploy.sh would replace the files above and the web app"
  exit 0
fi

mkdir -p "$BACKUP/dist"
for file in "${FILES[@]}"; do
  backed_up "$file" && continue
  [[ -e "$APP/dist/$file" ]] && install -D -m 644 "$APP/dist/$file" "$BACKUP/dist/$file"
  echo "$file" >>"$BACKUP/files.txt"
done
[[ -d "$BACKUP/www" ]] || cp -a "$APP/www" "$BACKUP/www"
echo "== stock originals kept in $BACKUP"

for file in "${FILES[@]}"; do
  install -D -o immich -g immich -m 644 "$SRC/server/dist/$file" "$APP/dist/$file"
done
rm -rf "$APP/www.new"
cp -a "$SRC/web/build" "$APP/www.new"
chown -R immich:immich "$APP/www.new"
rm -rf "$APP/www"
mv "$APP/www.new" "$APP/www"

restart "custom build of $VERSION deployed, undo with: lxc-deploy.sh restore"
