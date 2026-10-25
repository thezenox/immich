# Immich with timeline extras (unofficial fork)

This is an **unofficial fork of [Immich](https://github.com/immich-app/immich)**, not affiliated with or endorsed by
the Immich team. It adds a few timeline features to the web app that were asked for many times but are not
planned upstream. The changes live on the `timeline-extras` branch, which is stock Immich (currently **v3.3.5**)
plus a few small patches. For everything else about Immich, see the [upstream README](../README.md) and the
[official documentation](https://docs.immich.app).

## Features

**Albums as tiles in the timeline.** Photos of a short album, such as a holiday week, no longer flood the main
timeline: the album shows up as one tile with its cover, name, date range and number of items, in a row of its
own. A click (or "open in new tab") opens the album. Photos taken during that time that are not in the album
still show up individually, which makes it easy to spot what is missing from the album.

**Hide an album from the timeline.** Put `#notimeline` into the album description, and its photos disappear from
the main timeline. They stay in the album, search, map and people. Unlike archiving, nothing changes on the
photos themselves: remove the tag or the photo from the album and it is back. It also works across partner
sharing: if your partner hides one of their albums, its photos disappear from your timeline too (your own photos
are never hidden by someone else's album).

**Partner switch in the top bar.** A button with your partner's name next to the notifications turns their
photos in your timeline on and off with one click, instead of going through the account settings.

### Control

| Where | What |
| --- | --- |
| album description `#notimeline` | hide the album's photos from the timeline |
| album description `#tile` | show the album as a tile, however long it is |
| album description `#notile` | never show the album as a tile |
| server environment `IMMICH_ALBUM_TILE_MAX_DAYS` | albums spanning at most this many days become tiles (default `28`) |

Only albums you own or that are shared with you become tiles, since the tile has to open the album. Album changes
show up in the timeline after up to 30 seconds.

## What stays the same

- **No database changes.** Nothing is stored and no migration is added. You can switch back to the official
  Immich of the same version at any time.
- **Mobile app.** Only the server and the web app are patched. The official mobile app keeps working as before;
  its timeline shows all photos as usual.
- **API.** No endpoint changes; other clients keep working.

## Installation

Use the fork only with the Immich version it is based on (see above), as with any Immich server.

### Docker

Build the server image from this branch and use it instead of the official one:

```bash
git clone --branch timeline-extras --depth 1 <url of this repository> immich-timeline-extras
cd immich-timeline-extras
docker build -f server/Dockerfile -t immich-server:timeline-extras .
```

In your `docker-compose.yml`, replace the image of the `immich-server` service with `immich-server:timeline-extras`.
The machine learning container stays the official one in the same version. To switch back, set the official
image again.

### Proxmox LXC from community-scripts

The [community-scripts](https://community-scripts.github.io/ProxmoxVE/) Immich LXC builds Immich from source. The
scripts in `custom/` build the patched version next to the stock install and replace only the files the patch
changes:

```bash
# on a machine with a clone of this branch
custom/pack.sh                              # creates custom/immich-custom-v3.3.5.tar
scp custom/immich-custom-v3.3.5.tar custom/lxc-*.sh root@<lxc>:/root/

# in the LXC, as root
/root/lxc-build.sh /root/immich-custom-v3.3.5.tar
/root/lxc-test.sh                           # optional: try it on port 2284 first, `lxc-test.sh stop` ends it
/root/lxc-deploy.sh                         # replace the files and restart Immich
/root/lxc-deploy.sh restore                 # back to stock
```

The community-scripts `update` replaces the whole install, so after an Immich update the patch is gone until a
build for the new version is deployed.

## Limitations

- The features are in the web app only.
- Switching the partner off and on reloads the timeline from the top.
- A tile shows the album cover; landscape covers look best.

## How it works

[FORK.md](../FORK.md) describes the patches, the touched upstream files and how the fork is updated to new Immich
releases.

## License

Immich and this fork are licensed under the [GNU AGPL v3](../LICENSE).
