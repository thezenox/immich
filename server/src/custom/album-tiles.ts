import { type Kysely, sql } from 'kysely';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import type { TimeBucketOptions } from 'src/repositories/asset.repository.js';
import type { DB } from 'src/schema/index.js';
import { AlbumUserRole, AssetOrderBy, AssetVisibility } from 'src/enum.js';
import { anyUuid, asUuid } from 'src/utils/database.js';

// Custom patch, not part of upstream Immich (see FORK.md). In the main timeline only:
// - albums spanning at most IMMICH_ALBUM_TILE_MAX_DAYS days (default 28) collapse into a single wide tile:
//   the album cover stays, every other asset of the album is left out
// - `#tile` in the album description collapses an album regardless of its length, `#notile` never collapses it
// - `#notimeline` in the album description hides all of its assets
// Only albums the viewer owns or is a member of count, except that a `#notimeline` album of a partner in this
// timeline also hides the partner's own assets in it. Nothing is stored, so stock Immich runs on the same database.

const configuredMaxDays = Math.trunc(Number(process.env.IMMICH_ALBUM_TILE_MAX_DAYS));
const maxDays = configuredMaxDays > 0 ? configuredMaxDays : 28;

// Working out the affected albums takes about 80 ms on 250k assets, too slow for every time bucket request.
// Album changes therefore show up in the timeline after up to this delay.
const CACHE_TTL_MS = 30_000;

type MainTimelineOptions = TimeBucketOptions & { withPartners?: boolean };

export type AlbumTiles = {
  /** Collapsed albums, with their covers at the same index. */
  albumIds: string[];
  coverIds: string[];
  /** Hidden albums, with the owner whose assets they hide at the same index (null hides all of them). */
  hiddenAlbumIds: string[];
  hiddenOwnerIds: (string | null)[];
};

const cache = new Map<string, { expiresAt: number; tiles: Promise<AlbumTiles | undefined> }>();

/** Matches the request of the web photos page; every other timeline view stays untouched. */
const isMainTimeline = (options: MainTimelineOptions) =>
  !!options.withPartners &&
  !!options.withStacked &&
  !!options.userIds?.length &&
  options.visibility === AssetVisibility.Timeline &&
  options.orderBy !== AssetOrderBy.CreatedAt &&
  options.isFavorite === undefined &&
  options.isDuplicate === undefined &&
  !options.isTrashed &&
  !options.assetType &&
  !options.albumId &&
  !options.personId &&
  !options.tagId &&
  !options.bbox;

const uuidArray = (ids: (string | null)[]) => sql`${`{${ids.map((id) => id ?? 'NULL').join(',')}}`}::uuid[]`;

const loadAlbumTiles = async (db: Kysely<DB>, userIds: string[], auth: AuthDto) => {
  const { rows } = await sql<{ id: string; coverId: string; isHidden: boolean; ownerId: string; isMember: boolean }>`
    select
      tile_album.id,
      tile_album."albumThumbnailAssetId" as "coverId",
      coalesce(tile_album.description, '') ilike '%#notimeline%' as "isHidden",
      tile_owner."userId" as "ownerId",
      tile_user."userId" is not null as "isMember"
    from album tile_album
    inner join album_user tile_owner
      on tile_owner."albumId" = tile_album.id and tile_owner.role = ${sql.lit(AlbumUserRole.Owner)}
    left join album_user tile_user
      on tile_user."albumId" = tile_album.id and tile_user."userId" = ${asUuid(auth.user.id)}
    left join (
      select
        tile_member."albumId",
        max((tile_asset."localDateTime" at time zone 'UTC')::date)
          - min((tile_asset."localDateTime" at time zone 'UTC')::date) as days
      from album_asset tile_member
      inner join asset tile_asset on tile_asset.id = tile_member."assetId"
      where tile_asset."deletedAt" is null
      group by tile_member."albumId"
    ) tile_span on tile_span."albumId" = tile_album.id
    where tile_album."deletedAt" is null
      and (
        (
          coalesce(tile_album.description, '') ilike '%#notimeline%'
          and (tile_user."userId" is not null or tile_owner."userId" = ${anyUuid(userIds)})
        )
        or (
          tile_user."userId" is not null
          and coalesce(tile_album.description, '') not ilike '%#notile%'
          and (coalesce(tile_album.description, '') ilike '%#tile%' or tile_span.days < ${sql.lit(maxDays)})
          -- without a cover in this timeline the album would vanish, so its assets stay
          and exists (
            select 1
            from asset tile_cover
            left join stack tile_stack on tile_stack.id = tile_cover."stackId"
            where tile_cover.id = tile_album."albumThumbnailAssetId"
              and tile_cover."deletedAt" is null
              and tile_cover.visibility = ${sql.lit(AssetVisibility.Timeline)}
              and tile_cover."ownerId" = ${anyUuid(userIds)}
              and (tile_cover."stackId" is null or tile_stack."primaryAssetId" = tile_cover.id)
          )
        )
      )
  `.execute(db);

  if (rows.length === 0) {
    return;
  }

  const collapsed = rows.filter(({ isHidden }) => !isHidden);
  const hidden = rows.filter(({ isHidden }) => isHidden);
  return {
    albumIds: collapsed.map(({ id }) => id),
    coverIds: collapsed.map(({ coverId }) => coverId),
    hiddenAlbumIds: hidden.map(({ id }) => id),
    // a partner's album the viewer is not a member of only hides the partner's own assets
    hiddenOwnerIds: hidden.map(({ isMember, ownerId }) => (isMember ? null : ownerId)),
  };
};

/** Album tiles of the main timeline, undefined for every other timeline view or without affected albums. */
export const getAlbumTiles = (
  db: Kysely<DB>,
  options: MainTimelineOptions,
  auth: AuthDto,
): Promise<AlbumTiles | undefined> => {
  if (!isMainTimeline(options)) {
    return Promise.resolve(undefined);
  }

  const userIds = options.userIds!;
  const key = [auth.user.id, ...userIds.toSorted()].join(',');
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.tiles;
  }

  const tiles = loadAlbumTiles(db, userIds, auth);
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, tiles });
  tiles.catch(() => cache.delete(key));
  return tiles;
};

/** Filter for the timeline queries: drops hidden albums and everything but the cover of collapsed albums. */
export const notInAlbumTile = (tiles: AlbumTiles) => sql<boolean>`not exists (
  select 1
  from album_asset tile_member
  left join unnest(${uuidArray(tiles.albumIds)}, ${uuidArray(tiles.coverIds)}) as tile("albumId", "coverId")
    on tile."albumId" = tile_member."albumId"
  left join unnest(${uuidArray(tiles.hiddenAlbumIds)}, ${uuidArray(tiles.hiddenOwnerIds)}) as hidden("albumId", "ownerId")
    on hidden."albumId" = tile_member."albumId"
  where tile_member."assetId" = asset.id
    and (
      (hidden."albumId" is not null and (hidden."ownerId" is null or hidden."ownerId" = asset."ownerId"))
      or (tile."albumId" is not null and asset.id <> tile."coverId")
    )
)`;

/**
 * Ratio column of the time bucket: tile covers report their ratio negated. Real ratios are never negative, so the
 * web tells tiles apart by the sign and still knows the shape of the cover.
 */
export const albumTileRatio = (tiles?: AlbumTiles) =>
  tiles?.coverIds.length
    ? sql`case when "cte"."id" = any(${uuidArray(tiles.coverIds)}) then -"cte"."ratio" else "cte"."ratio" end`
    : sql.ref('ratio');
