import { Pool } from 'pg';

export interface Summary {
  /** 集計した日（日本時間、YYYY-MM-DD） */
  readonly date: string;
  readonly totalReservations: number;
  readonly totalGuests: number;
  readonly activeStores: number;
  readonly byHour: ReadonlyArray<{ hour: number; count: number }>;
  readonly byChannel: ReadonlyArray<{ channel: string; count: number }>;
  readonly topStores: ReadonlyArray<{ storeId: number; name: string; area: string; reservations: number; guests: number }>;
}

/** その日（日本時間）の予約だけを取り出す共通部分。$1 は日付（未指定なら今日） */
const DAY = `
  WITH target AS (
    SELECT COALESCE($1::date, (now() AT TIME ZONE 'Asia/Tokyo')::date) AS d
  ),
  day AS (
    SELECT r.*
    FROM reservations r, target
    WHERE r.reserved_at >= (target.d::timestamp AT TIME ZONE 'Asia/Tokyo')
      AND r.reserved_at <  ((target.d + 1)::timestamp AT TIME ZONE 'Asia/Tokyo')
  )`;

/** 本部向けダッシュボードの集計 */
export const summarize = async (pool: Pool, date?: string): Promise<Summary> => {
  const params = [date ?? null];
  const [totals, byHour, byChannel, topStores] = await Promise.all([
    pool.query(
      `${DAY}
       SELECT to_char((SELECT d FROM target), 'YYYY-MM-DD') AS date,
              count(*)::int AS reservations,
              COALESCE(sum(party_size), 0)::int AS guests,
              count(DISTINCT store_id)::int AS stores
       FROM day`,
      params,
    ),
    pool.query(
      `${DAY}
       SELECT extract(hour FROM reserved_at AT TIME ZONE 'Asia/Tokyo')::int AS hour, count(*)::int AS count
       FROM day GROUP BY 1 ORDER BY 1`,
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
       SELECT s.id AS "storeId", s.name, s.area,
              count(*)::int AS reservations, sum(day.party_size)::int AS guests
       FROM day JOIN stores s ON s.id = day.store_id
       GROUP BY s.id ORDER BY reservations DESC, s.id LIMIT 10`,
      params,
    ),
  ]);
  const t = totals.rows[0];
  return {
    date: t.date,
    totalReservations: t.reservations,
    totalGuests: t.guests,
    activeStores: t.stores,
    byHour: byHour.rows,
    byChannel: byChannel.rows,
    topStores: topStores.rows,
  };
};
