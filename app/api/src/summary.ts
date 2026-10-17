import { Pool } from 'pg';

/** 1日ぶんの合計 */
export interface Totals {
  readonly reservations: number;
  readonly guests: number;
  readonly stores: number;
}

export interface Summary {
  /** 集計した日（日本時間、YYYY-MM-DD） */
  readonly date: string;
  /** 絞り込んだエリア（全エリアなら null） */
  readonly area: string | null;
  readonly areas: ReadonlyArray<string>;
  /** 絞り込んだ範囲の店舗数 */
  readonly storeCount: number;
  readonly totalReservations: number;
  readonly totalGuests: number;
  readonly activeStores: number;
  /** 前週の同じ曜日 */
  readonly previous: Totals;
  readonly byHour: ReadonlyArray<{ hour: number; count: number; previous: number }>;
  readonly byChannel: ReadonlyArray<{ channel: string; count: number }>;
  readonly byArea: ReadonlyArray<{ area: string; count: number; guests: number }>;
  /** 集計した日の6日前〜7日後の日ごとの予約件数 */
  readonly daily: ReadonlyArray<{ date: string; count: number; guests: number }>;
  readonly topStores: ReadonlyArray<{
    storeId: number;
    name: string;
    area: string;
    reservations: number;
    guests: number;
    previous: number;
  }>;
}

/**
 * その日（日本時間）の予約だけを取り出す共通部分。
 * $1 は日付（未指定なら今日）、$2 はエリア（未指定なら全エリア）。
 * prev は前週の同じ曜日。
 */
const DAY = `
  WITH target AS (
    SELECT COALESCE($1::date, (now() AT TIME ZONE 'Asia/Tokyo')::date) AS d
  ),
  scope AS (
    SELECT id FROM stores WHERE $2::text IS NULL OR area = $2::text
  ),
  ranged AS (
    SELECT r.*, (r.reserved_at AT TIME ZONE 'Asia/Tokyo')::date AS day_jst
    FROM reservations r, target
    WHERE r.store_id IN (SELECT id FROM scope)
      AND r.reserved_at >= ((target.d - 7)::timestamp AT TIME ZONE 'Asia/Tokyo')
      AND r.reserved_at <  ((target.d + 8)::timestamp AT TIME ZONE 'Asia/Tokyo')
  ),
  day AS (SELECT ranged.* FROM ranged, target WHERE day_jst = target.d),
  prev AS (SELECT ranged.* FROM ranged, target WHERE day_jst = target.d - 7)`;

/** 本部向けダッシュボードの集計 */
export const summarize = async (pool: Pool, date?: string, area?: string): Promise<Summary> => {
  const params = [date ?? null, area ?? null];
  const [totals, areas, byHour, byChannel, byArea, daily, topStores] = await Promise.all([
    pool.query(
      `${DAY}
       SELECT to_char((SELECT d FROM target), 'YYYY-MM-DD') AS date,
              (SELECT count(*) FROM scope)::int AS "storeCount",
              (SELECT count(*) FROM day)::int AS reservations,
              (SELECT COALESCE(sum(party_size), 0) FROM day)::int AS guests,
              (SELECT count(DISTINCT store_id) FROM day)::int AS stores,
              (SELECT count(*) FROM prev)::int AS "prevReservations",
              (SELECT COALESCE(sum(party_size), 0) FROM prev)::int AS "prevGuests",
              (SELECT count(DISTINCT store_id) FROM prev)::int AS "prevStores"`,
      params,
    ),
    pool.query(`SELECT area FROM stores GROUP BY area ORDER BY min(id % 8)`),
    pool.query(
      `${DAY}
       SELECT h.hour,
              (SELECT count(*) FROM day WHERE extract(hour FROM reserved_at AT TIME ZONE 'Asia/Tokyo') = h.hour)::int AS count,
              (SELECT count(*) FROM prev WHERE extract(hour FROM reserved_at AT TIME ZONE 'Asia/Tokyo') = h.hour)::int AS previous
       FROM (SELECT DISTINCT extract(hour FROM reserved_at AT TIME ZONE 'Asia/Tokyo')::int AS hour FROM ranged) h
       ORDER BY 1`,
      params,
    ),
    pool.query(
      `${DAY}
       SELECT channel, count(*)::int AS count
       FROM day GROUP BY 1 ORDER BY 2 DESC`,
      params,
    ),
    pool.query(
      `${DAY}
       SELECT s.area, count(*)::int AS count, sum(day.party_size)::int AS guests
       FROM day JOIN stores s ON s.id = day.store_id
       GROUP BY 1 ORDER BY 2 DESC`,
      params,
    ),
    pool.query(
      `${DAY}
       SELECT to_char(g.d, 'YYYY-MM-DD') AS date,
              count(ranged.id)::int AS count,
              COALESCE(sum(ranged.party_size), 0)::int AS guests
       FROM target, generate_series(target.d - 6, target.d + 7, interval '1 day') AS g(d)
       LEFT JOIN ranged ON ranged.day_jst = g.d::date
       GROUP BY g.d ORDER BY g.d`,
      params,
    ),
    pool.query(
      `${DAY}
       SELECT s.id AS "storeId", s.name, s.area,
              count(*)::int AS reservations, sum(day.party_size)::int AS guests,
              (SELECT count(*) FROM prev WHERE prev.store_id = s.id)::int AS previous
       FROM day JOIN stores s ON s.id = day.store_id
       GROUP BY s.id ORDER BY reservations DESC, s.id LIMIT 10`,
      params,
    ),
  ]);
  const t = totals.rows[0];
  return {
    date: t.date,
    area: area ?? null,
    areas: areas.rows.map((r) => r.area),
    storeCount: t.storeCount,
    totalReservations: t.reservations,
    totalGuests: t.guests,
    activeStores: t.stores,
    previous: { reservations: t.prevReservations, guests: t.prevGuests, stores: t.prevStores },
    byHour: byHour.rows,
    byChannel: byChannel.rows,
    byArea: byArea.rows,
    daily: daily.rows,
    topStores: topStores.rows,
  };
};
