import { Summary } from './summary';

/** DBにつながずに画面を確認するための固定データ（DB_HOST が無いときだけ使う） */
export const fixture = (date?: string): Summary => {
  // シードと同じ形（昼と夜に山）
  const counts = [265, 668, 272, 131, 123, 136, 266, 495, 681, 417, 146];
  const byHour = counts.map((count, i) => ({ hour: 11 + i, count }));
  const total = byHour.reduce((n, h) => n + h.count, 0);
  const areas = ['東京', '大阪', '名古屋', '福岡', '札幌', '仙台', '広島', '横浜'];
  return {
    date: date ?? new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10),
    totalReservations: total,
    totalGuests: Math.round(total * 3.5),
    activeStores: 499,
    byHour,
    byChannel: [
      { channel: 'app', count: Math.round(total * 0.42) },
      { channel: 'web', count: Math.round(total * 0.33) },
      { channel: 'phone', count: total - Math.round(total * 0.42) - Math.round(total * 0.33) },
    ],
    topStores: Array.from({ length: 10 }, (_, i) => {
      const id = 1 + ((i * 7) % 24) * 21;
      const reservations = [54, 54, 52, 51, 50, 50, 47, 46, 45, 42][i];
      return { storeId: id, name: `${areas[id % 8]} ${id}号店`, area: areas[id % 8], reservations, guests: Math.round(reservations * 3.2) };
    }),
  };
};
