import { useEffect, useMemo, useState } from 'react';
import { AppConfig, Summary, fetchSummary, loadConfig } from './api';

const STORE_COUNT = 500;
const CHANNEL_LABEL: Record<string, string> = { app: '会員アプリ', web: 'Web', phone: '電話' };
const ENV_LABEL: Record<string, string> = { dev: '開発環境', stg: '検証環境', prod: '本番環境', local: '手元' };
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const formatDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}年${m}月${d}日（${weekday}）`;
};

const shiftDate = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const num = (n: number) => n.toLocaleString('ja-JP');

export const App = () => {
  const [config, setConfig] = useState<AppConfig>();
  const [summary, setSummary] = useState<Summary>();
  const [date, setDate] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig().then(setConfig).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!config) return;
    setLoading(true);
    fetchSummary(config.apiUrl, date)
      .then((s) => {
        setSummary(s);
        setError(undefined);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [config, date]);

  return (
    <div className="page">
      <header className="header">
        <div>
          <p className="eyebrow">予約SaaS ・ 本部向け</p>
          <h1>多店舗ダッシュボード</h1>
        </div>
        {summary && (
          <nav className="date-nav" aria-label="日付">
            <button onClick={() => setDate(shiftDate(summary.date, -1))} aria-label="前の日">‹</button>
            <span className="date">{formatDate(summary.date)}</span>
            <button onClick={() => setDate(shiftDate(summary.date, 1))} aria-label="次の日">›</button>
            <button className="today" onClick={() => setDate(undefined)}>今日</button>
          </nav>
        )}
      </header>

      <main className={loading ? 'main is-loading' : 'main'}>
        {error && <div className="error">{error}</div>}
        {summary && (
          <>
            <section className="kpis">
              <Kpi label="予約件数" value={num(summary.totalReservations)} unit="件" />
              <Kpi label="来店予定人数" value={num(summary.totalGuests)} unit="名" />
              <Kpi label="予約のある店舗" value={num(summary.activeStores)} unit={`/ ${num(STORE_COUNT)} 店舗`} />
            </section>

            <section className="grid">
              <Card title="時間帯別の予約件数">
                <HourChart data={summary.byHour} />
              </Card>
              <Card title="予約の経路">
                <ChannelBreakdown data={summary.byChannel} total={summary.totalReservations} />
              </Card>
            </section>

            <Card title="予約が多い店舗（上位10店舗）">
              <TopStores data={summary.topStores} />
            </Card>
          </>
        )}
      </main>

      <footer className="footer">
        {config && (
          <>
            <span className={`badge env-${config.env}`}>{ENV_LABEL[config.env] ?? config.env}</span>
            <span className="path">入口 CloudFront（WAF）→ 画面 S3 ／ API 非公開のALB＋Fargate → 予約DB（読み取り専用）</span>
          </>
        )}
      </footer>
    </div>
  );
};

const Kpi = ({ label, value, unit }: { label: string; value: string; unit: string }) => (
  <div className="kpi">
    <p className="kpi-label">{label}</p>
    <p className="kpi-value">
      {value}
      <span className="kpi-unit">{unit}</span>
    </p>
  </div>
);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="card">
    <h2>{title}</h2>
    {children}
  </div>
);

const HourChart = ({ data }: { data: Summary['byHour'] }) => {
  const max = Math.max(1, ...data.map((d) => d.count));
  const peak = data.reduce((a, b) => (b.count > a.count ? b : a), data[0] ?? { hour: 0, count: 0 });
  return (
    <div className="hours">
      {data.map((d) => (
        <div key={d.hour} className="hour" title={`${d.hour}時台：${num(d.count)}件`}>
          <span className="hour-count">{d.hour === peak.hour ? num(d.count) : ''}</span>
          <div className={d.hour === peak.hour ? 'bar is-peak' : 'bar'} style={{ height: `${(d.count / max) * 100}%` }} />
          <span className="hour-label">{d.hour}</span>
        </div>
      ))}
    </div>
  );
};

const ChannelBreakdown = ({ data, total }: { data: Summary['byChannel']; total: number }) => {
  const rows = useMemo(() => data.map((d) => ({ ...d, share: total ? d.count / total : 0 })), [data, total]);
  return (
    <div className="channels">
      <div className="stack">
        {rows.map((r) => (
          <div key={r.channel} className={`segment ch-${r.channel}`} style={{ width: `${r.share * 100}%` }} />
        ))}
      </div>
      <ul className="legend">
        {rows.map((r) => (
          <li key={r.channel}>
            <span className={`dot ch-${r.channel}`} />
            <span className="legend-name">{CHANNEL_LABEL[r.channel] ?? r.channel}</span>
            <span className="legend-value">{num(r.count)}件</span>
            <span className="legend-share">{Math.round(r.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const TopStores = ({ data }: { data: Summary['topStores'] }) => {
  const max = Math.max(1, ...data.map((d) => d.reservations));
  return (
    <table className="stores">
      <thead>
        <tr>
          <th>順位</th>
          <th>店舗</th>
          <th>エリア</th>
          <th className="right">予約件数</th>
          <th className="right">来店予定人数</th>
        </tr>
      </thead>
      <tbody>
        {data.map((s, i) => (
          <tr key={s.storeId}>
            <td className="rank">{i + 1}</td>
            <td>{s.name}</td>
            <td className="muted">{s.area}</td>
            <td className="right">
              <span className="inline-bar" style={{ width: `${(s.reservations / max) * 64}px` }} />
              {num(s.reservations)}
            </td>
            <td className="right">{num(s.guests)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
