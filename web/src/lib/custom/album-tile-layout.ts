import type { TimelineAsset } from '$lib/managers/timeline-manager/types';
import type { CommonJustifiedLayout, CommonLayoutOptions } from '$lib/utils/layout-utils';

// Custom patch, not part of upstream Immich (see FORK.md): album tiles get a row of their own, the assets around
// them keep the regular justified layout.

/** The server reports the ratio of tile covers negated (see albumTileRatio in server/src/custom/album-tiles.ts). */
export const isAlbumTile = (asset: TimelineAsset) => asset.ratio < 0;

type Position = { top: number; left: number; width: number; height: number };
type Layout = (assets: TimelineAsset[], options: CommonLayoutOptions) => CommonJustifiedLayout;

/**
 * At most half the row on wide screens (the full row on narrow ones) and 1.5 to 2.5 regular rows high, in the
 * shape of the cover where that fits, so the cover is cropped as little as possible. Portrait covers get a square.
 */
const getTileSize = ({ rowWidth, rowHeight }: CommonLayoutOptions, asset: TimelineAsset) => {
  const maxWidth = rowWidth < 768 ? rowWidth : rowWidth / 2;
  const maxHeight = 2.5 * rowHeight;
  const ratio = Math.max(-asset.ratio, 1);
  const width = Math.min(maxWidth, maxHeight * ratio);
  const height = Math.min(maxHeight, Math.max(1.5 * rowHeight, width / ratio));
  return { width: Math.round(width), height: Math.round(height) };
};

/** Layout of a day with album tiles, undefined for a day without any so the regular layout applies. */
export const getAlbumTileLayout = (
  assets: TimelineAsset[],
  options: CommonLayoutOptions,
  layout: Layout,
): CommonJustifiedLayout | undefined => {
  if (assets.every((asset) => !isAlbumTile(asset))) {
    return;
  }

  const positions: Position[] = [];
  let top = 0;
  let width = 0;
  let run: TimelineAsset[] = [];

  const addRows = (rowsWidth: number, rowsHeight: number) => {
    top += rowsHeight + options.spacing;
    width = Math.max(width, rowsWidth);
  };

  const layoutRun = () => {
    if (run.length === 0) {
      return;
    }
    const geometry = layout(run, options);
    for (let i = 0; i < run.length; i++) {
      const position = geometry.getPosition(i);
      positions.push({ ...position, top: position.top + top });
    }
    addRows(geometry.containerWidth, geometry.containerHeight);
    run = [];
  };

  for (const asset of assets) {
    if (!isAlbumTile(asset)) {
      run.push(asset);
      continue;
    }
    layoutRun();
    const size = getTileSize(options, asset);
    positions.push({ top, left: 0, ...size });
    // the day takes the full row either way, so no other day moves up next to the tile
    addRows(options.rowWidth, size.height);
  }
  layoutRun();

  return {
    containerWidth: width,
    containerHeight: top - options.spacing,
    getTop: (index) => positions[index].top,
    getLeft: (index) => positions[index].left,
    getWidth: (index) => positions[index].width,
    getHeight: (index) => positions[index].height,
    getPosition: (index) => positions[index],
  };
};
