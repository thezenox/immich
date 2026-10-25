# How this fork works

This fork is stock Immich plus a few small patches on the `timeline-extras` branch, which sits on top of an
upstream release tag. The patches only touch the server and the web app; the mobile app does not use the changed
queries and stays the official one. For what the fork offers and how to install it, see
[.github/README.md](.github/README.md).

**No database changes.** The patches add no tables, columns or migrations and store nothing. Stock Immich runs
on the same database at any time, so going back means running the official build again.

## Features in detail

### Album tiles in the main timeline

Short albums collapse into a single tile in the main timeline (web photos page only). The tile is the album
cover with the album name, date range and number of items; it links to the album, so a click, a middle click or
"open in new tab" opens the album. It always gets a row of its own: at most half the width on wide screens (the
full width on narrow ones) and 1.5 to 2.5 regular rows high, in the shape of the cover where that fits; portrait
covers get a square.

- An album collapses when its assets span at most `IMMICH_ALBUM_TILE_MAX_DAYS` calendar days (server
  environment variable, default `28`).
- `#tile` in the album description collapses it regardless of its length, `#notile` never collapses it.
- Only albums the viewer owns or is a member of collapse, since the tile has to open the album. The assets of a
  partner's private short album stay single in the viewer's timeline.
- An album whose cover is not in the viewer's timeline (archived, trashed, partner switched off) does not
  collapse, otherwise it would vanish.
- Assets taken during the album's period but not in the album stay in the timeline as single assets.
- The server works out the affected albums once and caches them for 30 seconds per user (about 80 ms on
  250k assets), so album changes show up in the timeline after up to 30 seconds.
- The server keeps the cover and reports its ratio negated. The web recognises tiles by the negative ratio
  plus the album list and splits the layout of a day at each tile, so the assets around it keep Immich's regular
  justified layout. A negative ratio must never reach Immich's own layout code.

### Hide an album from the timeline

`#notimeline` in the album description hides all its assets from the main timeline. They stay visible in the
album, search, map, people and memories. This works for albums the viewer owns or is a member of, and for the
albums of a partner in the timeline: those hide only the partner's own assets in them, so a partner can never
hide the viewer's assets.

### Partner switch in the navigation bar

A button with the partner's name, left of the notifications, turns the partner's assets in the main timeline on
and off (struck through when off, an icon only on narrow screens). It sets the same `inTimeline` flag as the
partner sharing settings and reloads the timeline. It only shows when a partner shares with the current user.

## Touched upstream files

New files never conflict on a rebase; the upstream files only get a few lines each.

| File | Change |
| --- | --- |
| `server/src/custom/album-tiles.ts` | new: album tile rules and SQL fragments |
| `server/src/repositories/asset.repository.ts` | import, one filter line in `getTimeBuckets` and `getTimeBucket`, ratio column in `getTimeBucket` |
| `web/src/lib/custom/*` | new: tile layout, tile overlay, tile lookup, partner switch |
| `web/src/lib/utils/layout-utils.ts` | import and 4 lines in `getJustifiedLayoutFromAssets` for the tile rows |
| `web/src/routes/(user)/photos/[[assetId=id]]/+page.svelte` | imports, timeline options with the partner switch version, `onThumbnailClick` and `customThumbnailLayout` |
| `web/src/lib/components/shared-components/navigation-bar/NavigationBar.svelte` | import and `<PartnerTimelineToggle />` |
| `custom/*`, `FORK.md`, `.github/README.md` | new: scripts and documentation of this fork |

The partner switch reloads the timeline by changing its options (`partnerTimelineVersion`, which the SDK does not
send to the server). Do not rebuild the timeline with `{#key}` instead: the old instance's `onDestroy` destroys
the new instance's manager through the bound `timelineManager`, which leaves the timeline empty.

The server detects the main timeline by the options the photos page sends (`isMainTimeline` in
`album-tiles.ts`). If upstream changes those options, the tiles silently disappear: check this after each update.

## Scripts for community-scripts LXC installs

The [community-scripts](https://community-scripts.github.io/ProxmoxVE/) Immich LXC builds Immich from source:
`/opt/immich/source` is the stock source with its installed dependencies, `/opt/immich/app` the running install.
The scripts build the patched version next to it and replace only the files the patch changes.

| Script | Runs on | Does |
| --- | --- | --- |
| `custom/pack.sh` | a clone of this fork | packs the files changed since the release tag into `custom/immich-custom-<tag>.tar` |
| `custom/lxc-build.sh <tar>` | the LXC, as root | copies the stock source to `/opt/immich-custom/src`, applies the files and builds server and web; checks that the tarball matches the installed version |
| `custom/lxc-test.sh` | the LXC, as root | starts that build as a second, API-only Immich on port 2284 (same database and media, no background jobs); `stop` stops it. Settings changed there, such as the partner switch, are the real ones |
| `custom/lxc-deploy.sh` | the LXC, as root | replaces the changed server files and the web app of the install, keeps the originals and restarts `immich-web`; `check` only shows what it would replace, `restore` puts the originals back |

The community-scripts `update` replaces the whole install, so after an Immich update the patch is gone until a
build for the new version is deployed.

## Updating to a new release

```bash
git fetch --tags upstream
git rebase --onto vNEW vOLD timeline-extras
```

Conflicts can only occur in the upstream files listed above. After the rebase, check that:

- the photos page still passes `withPartners`, `withStacked` and `visibility: timeline` (see `isMainTimeline`)
- `getTimeBucket` still returns a `ratio` column and the web still reads it unchanged into `TimelineAsset.ratio`
- the timeline still offers `customThumbnailLayout` and `onThumbnailClick`
- `getJustifiedLayoutFromAssets` is still the only way the timeline lays out a day
