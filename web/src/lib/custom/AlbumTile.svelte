<script lang="ts">
  import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
  import type { TimelineAsset } from '$lib/managers/timeline-manager/types';
  import { Route } from '$lib/route';
  import { getAssetMediaUrl } from '$lib/utils';
  import { getAlbumDateRange } from '$lib/utils/date-time';
  import { AssetMediaSize, type AlbumResponseDto } from '@immich/sdk';
  import { Icon } from '@immich/ui';
  import { mdiImageAlbum } from '@mdi/js';
  import { t } from 'svelte-i18n';

  // Custom patch, not part of upstream Immich (see FORK.md): overlay that turns an album cover in the main
  // timeline into an album tile. It is a real link to the album above the thumbnail's own link to the asset, so
  // middle click, ctrl click and "open in new tab" open the album too. While selecting, clicks pass through to the
  // thumbnail; keyboard users reach the album through the thumbnail (onThumbnailClick in album-tiles.svelte.ts).

  type Props = {
    asset: TimelineAsset;
    album: AlbumResponseDto;
  };

  let { asset, album }: Props = $props();
</script>

<a
  href={Route.viewAlbum(album)}
  class={[
    'absolute inset-0 z-3 overflow-hidden rounded-sm',
    assetMultiSelectManager.selectionActive && 'pointer-events-none',
  ]}
  draggable="false"
  tabindex={-1}
  aria-label={album.albumName}
>
  <!-- the regular thumbnail is too small for the wide tile, the preview stays sharp -->
  <img
    src={getAssetMediaUrl({ id: asset.id, size: AssetMediaSize.Preview, cacheKey: asset.thumbhash })}
    alt=""
    class="size-full object-cover"
    draggable="false"
    loading="lazy"
  />
  <div class="absolute inset-0 bg-linear-to-t from-black/75 via-black/15 via-40% to-transparent"></div>
  <div class="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3 text-white sm:gap-1 sm:p-6">
    <span class="flex items-center gap-1.5 text-xs font-medium opacity-90 sm:text-sm">
      <Icon icon={mdiImageAlbum} size="16" aria-hidden />
      {$t('items_count', { values: { count: album.assetCount } })}
    </span>
    <span class="truncate text-lg/tight font-semibold sm:text-3xl/tight">{album.albumName}</span>
    {#if album.startDate && album.endDate}
      <span class="truncate text-sm opacity-90 sm:text-lg">{getAlbumDateRange(album.startDate, album.endDate)}</span>
    {/if}
  </div>
</a>
