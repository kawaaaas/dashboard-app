/** 部品（@acme/platform）が画面と一緒に置く設定。本番では apiUrl は空（同じドメインの /api/*） */
export interface AppConfig {
  readonly apiUrl: string;
  readonly env: string;
}

export interface Summary {
  readonly date: string;
  readonly totalReservations: number;
  readonly totalGuests: number;
  readonly activeStores: number;
  readonly byHour: ReadonlyArray<{ hour: number; count: number }>;
  readonly byChannel: ReadonlyArray<{ channel: string; count: number }>;
  readonly topStores: ReadonlyArray<{ storeId: number; name: string; area: string; reservations: number; guests: number }>;
}

export const loadConfig = async (): Promise<AppConfig> => {
  const res = await fetch('/config.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('config.json を読み込めませんでした');
  return res.json();
};

export const fetchSummary = async (apiUrl: string, date?: string): Promise<Summary> => {
  const url = new URL('/api/summary', apiUrl || window.location.origin);
  if (date) url.searchParams.set('date', date);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`集計を取得できませんでした（${res.status}）`);
  return res.json();
};
