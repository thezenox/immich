#!/usr/bin/env bash
# Packs every file this branch changes compared to its upstream release tag into a tarball for lxc-build.sh.
# Uses the committed state, not the working tree.
#
#   custom/pack.sh [base-tag]    default: the newest upstream release tag below HEAD
set -euo pipefail
cd "$(dirname "$0")/.."

BASE=${1:-$(git describe --tags --abbrev=0 --match 'v[0-9]*' --exclude '*-*' HEAD)}
OUT=${OUT:-custom/immich-custom-$BASE.tar}

mapfile -t FILES < <(git diff --name-only --diff-filter=AM "$BASE" HEAD)
if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "no changes against $BASE" >&2
  exit 1
fi

# custom-base.txt lets lxc-build.sh check that the patch matches the installed version
git archive --format=tar -o "$OUT" --add-virtual-file="custom-base.txt:$BASE" HEAD -- "${FILES[@]}"
echo "packed ${#FILES[@]} files changed since $BASE into $OUT"
