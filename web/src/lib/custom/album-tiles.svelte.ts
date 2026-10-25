import { getAllAlbums, type AlbumResponseDto } from '@immich/sdk';
import { SvelteMap } from 'svelte/reactivity';
import { goto } from '$app/navigation';
import { isAlbumTile } from '$lib/custom/album-tile-layout';
import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
import type { TimelineDay } from '$lib/managers/timeline-manager/timeline-day.svelte';
import type { TimelineManager } from '$lib/managers/timeline-manager/timeline-manager.svelte';
import type { TimelineAsset } from '$lib/managers/timeline-manager/types';
import { Route } from '$lib/route';

// Custom patch, not part of upstream Immich (see FORK.md): the server collapses short albums in the main
// timeline into their cover (see isAlbumTile); this finds the album of a tile and opens it on click.

type ThumbnailClick = (
  timelineManager: TimelineManager,
  assets: TimelineAsset[],
  groupTitle: string,
  asset: TimelineAsset,
) => void;

export class AlbumTiles {
  #albumsByCover = new SvelteMap<string, AlbumResponseDto>();

  constructor() {
    void this.load();
  }

  async load() {
    const albums = await getAllAlbums({});
    this.#albumsByCover.clear();
    for (const album of albums) {
      if (album.albumThumbnailAssetId) {
        this.#albumsByCover.set(album.albumThumbnailAssetId, album);
      }
    }
  }

  getAlbum(asset: TimelineAsset) {
    return isAlbumTile(asset) ? this.#albumsByCover.get(asset.id) : undefined;
  }

  onThumbnailClick = (
    asset: TimelineAsset,
    timelineManager: TimelineManager,
    timelineDay: TimelineDay,
    onClick: ThumbnailClick,
  ) => {
    const album = this.getAlbum(asset);
    if (album && !assetMultiSelectManager.selectionActive) {
      void goto(Route.viewAlbum(album));
      return;
    }
    onClick(timelineManager, timelineDay.getAssets(), timelineDay.groupTitle, asset);
  };
}
