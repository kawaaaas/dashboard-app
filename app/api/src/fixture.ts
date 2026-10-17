import { Summary } from './summary';

const AREAS = ['東京', '大阪', '名古屋', '福岡', '札幌', '仙台', '広島', '横浜'];
const HOURS = [265, 668, 272, 131, 123, 136, 266, 495, 681, 417, 146];

const shift = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** 曜日と日付から決まる、ゆらぎのある倍率（同じ日なら毎回同じ値） */
const factor = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const weekend = weekday === 0 || weekday === 5 || weekday === 6 ? 1.38 : 1;
  return weekend * (0.94 + ((d * 37) % 13) / 100);
};

/** DBにつながずに画面を確認するための固定データ（DB_HOST が無いときだけ使う） */
export const fixture = (date?: string, area?: string): Summary => {
  const day = date ?? new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const scale = area ? 1 / AREAS.length : 1;
  const count = (d: string, base: number) => Math.round(base * factor(d) * scale);
  const byHour = HOURS.map((base, i) => ({ hour: 11 + i, count: count(day, base), previous: count(shift(day, -7), base * 0.96) }));
  const total = byHour.reduce((n, h) => n + h.count, 0);
  const prevTotal = byHour.reduce((n, h) => n + h.previous, 0);
  const storeCount = area ? 63 : 500;
  return {
    date: day,
    area: area ?? null,
    areas: AREAS,
    storeCount,
    totalReservations: total,
    totalGuests: Math.round(total * 3.2),
    activeStores: storeCount - 1,
    previous: { reservations: prevTotal, guests: Math.round(prevTotal * 3.2), stores: storeCount - 2 },
    byHour,
    byChannel: [
      { channel: 'app', count: Math.round(total * 0.42) },
      { channel: 'web', count: Math.round(total * 0.33) },
      { channel: 'phone', count: total - Math.round(total * 0.42) - Math.round(total * 0.33) },
    ],
    byArea: area
      ? [{ area, count: total, guests: Math.round(total * 3.2) }]
      : AREAS.map((a, i) => {
          const c = Math.round((total / AREAS.length) * (1.18 - i * 0.05));
          return { area: a, count: c, guests: Math.round(c * 3.2) };
        }),
    daily: Array.from({ length: 14 }, (_, i) => {
      const d = shift(day, i - 6);
      const c = Math.round(3000 * factor(d) * scale);
      return { date: d, count: c, guests: Math.round(c * 3.2) };
    }),
    topStores: Array.from({ length: 10 }, (_, i) => {
      const id = 1 + ((i * 7) % 24) * 21;
      const reservations = [54, 54, 52, 51, 50, 50, 47, 46, 45, 42][i];
      const storeArea = area ?? AREAS[id % 8];
      return { storeId: id, name: `${storeArea} ${id}号店`, area: storeArea, reservations, guests: Math.round(reservations * 3.2), previous: reservations - 6 + ((i * 5) % 11) };
    }),
  };
};
