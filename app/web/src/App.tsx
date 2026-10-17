import { ReactNode, useEffect, useState } from 'react';
import { AppConfig, Summary, fetchSummary, loadConfig } from './api';

const CHANNEL_LABEL: Record<string, string> = { app: '会員アプリ', web: 'Web', phone: '電話' };
const CHANNEL_ORDER = ['app', 'web', 'phone'];
const ENV_LABEL: Record<string, string> = { dev: '開発環境', stg: '検証環境', prod: '本番環境', local: '手元' };
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const NAV = ['ダッシュボード', '予約一覧', '店舗', '顧客', 'レポート'];

const parse = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const weekday = (date: string) => WEEKDAYS[parse(date).getUTCDay()];
const formatDate = (date: string) => {
  const d = parse(date);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${weekday(date)}）`;
};
const shortDate = (date: string) => `${parse(date).getUTCMonth() + 1}/${parse(date).getUTCDate()}`;
const shiftDate = (date: string, days: number) => {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const todayJst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const num = (n: number) => n.toLocaleString('ja-JP');
const timeNow = () => new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

/** 前週同曜日との差（%）。前週が0なら出さない */
const change = (now: number, before: number) => (before ? ((now - before) / before) * 100 : undefined);

/** 目盛り：0 から、きりのよい間隔で max を超えるまで */
const ticks = (max: number, count = 4) => {
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
};

export const App = () => {
  const [config, setConfig] = useState<AppConfig>();
  const [summary, setSummary] = useState<Summary>();
  const [date, setDate] = useState<string>();
  const [area, setArea] = useState<string>();
  const [reload, setReload] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig().then(setConfig).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!config) return;
    setLoading(true);
    fetchSummary(config.apiUrl, date, area)
      .then((s) => {
        setSummary(s);
        setUpdatedAt(timeNow());
        setError(undefined);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [config, date, area, reload]);

  const isToday = summary?.date === todayJst();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            予
          </span>
          <div>
            <p className="brand-name">Acme 予約</p>
            <p className="brand-org">本部（全500店舗）</p>
          </div>
        </div>
        <nav className="nav" aria-label="メニュー">
          {NAV.map((label, i) => (
            <span key={label} className={i === 0 ? 'nav-item is-active' : 'nav-item'} aria-current={i === 0 ? 'page' : undefined}>
              {label}
            </span>
          ))}
        </nav>
        <div className="sidebar-foot">
          {config && <span className={`env env-${config.env}`}>{ENV_LABEL[config.env] ?? config.env}</span>}
          <span className="nav-item">設定</span>
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <div>
            <p className="crumbs">本部 ／ {summary?.area ?? '全エリア'}</p>
            <h1>ダッシュボード</h1>
          </div>
          <div className="user">
            <span className="avatar" aria-hidden>
              本
            </span>
            <span className="user-name">本部 運営チーム</span>
          </div>
        </header>

        <div className="filters" role="toolbar" aria-label="絞り込み">
          {summary && (
            <>
              <div className="date-nav">
                <button className="btn icon" onClick={() => setDate(shiftDate(summary.date, -1))} aria-label="前の日">
                  ‹
                </button>
                <span className="date">{formatDate(summary.date)}</span>
                <button className="btn icon" onClick={() => setDate(shiftDate(summary.date, 1))} aria-label="次の日">
                  ›
                </button>
                <button className="btn" onClick={() => setDate(undefined)} disabled={isToday}>
                  今日
                </button>
              </div>
              <label className="select">
                <span>エリア</span>
                <select value={area ?? ''} onChange={(e) => setArea(e.target.value || undefined)}>
                  <option value="">全エリア</option>
                  {summary.areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <div className="updated">
            {updatedAt && <span>最終更新 {updatedAt}</span>}
            <button className="btn" onClick={() => setReload((n) => n + 1)} disabled={loading}>
              {loading ? '読み込み中…' : '更新'}
            </button>
          </div>
        </div>

        <main className={loading ? 'main is-loading' : 'main'}>
          {error && <div className="error">{error}</div>}
          {summary && (
            <>
              <section className="kpis">
                <Kpi label="予約件数" value={summary.totalReservations} before={summary.previous.reservations} unit="件" />
                <Kpi label="来店予定人数" value={summary.totalGuests} before={summary.previous.guests} unit="名" />
                <Kpi
                  label="1組あたりの人数"
                  value={summary.totalReservations ? summary.totalGuests / summary.totalReservations : 0}
                  before={summary.previous.reservations ? summary.previous.guests / summary.previous.reservations : 0}
                  unit="名"
                  digits={1}
                />
                <Kpi
                  label="予約のある店舗"
                  value={summary.activeStores}
                  before={summary.previous.stores}
                  unit={`/ ${num(summary.storeCount)} 店舗`}
                />
              </section>

              <section className="grid-2-1">
                <Card title="日別の予約件数" note="前後2週間。棒を押すとその日に切り替わります">
                  <DailyChart data={summary.daily} selected={summary.date} today={todayJst()} onSelect={setDate} />
                </Card>
                <Card title="予約の経路">
                  <ChannelBreakdown data={summary.byChannel} total={summary.totalReservations} />
                </Card>
              </section>

              <section className="grid-2-1">
                <Card title="時間帯別の予約件数" note={`${shortDate(summary.date)}（${weekday(summary.date)}）と前週の同じ曜日`}>
                  <HourChart data={summary.byHour} />
                </Card>
                <Card title="エリア別の予約件数">
                  <AreaBars data={summary.byArea} selected={summary.area} onSelect={setArea} />
                </Card>
              </section>

              <Card title="予約が多い店舗" note="上位10店舗">
                <TopStores data={summary.topStores} />
              </Card>
            </>
          )}
        </main>

        <footer className="footer">
          入口 CloudFront（WAF）→ 画面 S3 ／ API 非公開の ALB＋Fargate → 予約DB（読み取り専用）
        </footer>
      </div>
    </div>
  );
};

const Delta = ({ now, before, suffix = '前週比' }: { now: number; before: number; suffix?: string }) => {
  const pct = change(now, before);
  if (pct === undefined) return <span className="delta">—</span>;
  const flat = Math.abs(pct) < 0.05;
  const cls = flat ? 'delta' : pct > 0 ? 'delta is-up' : 'delta is-down';
  const arrow = flat ? '→' : pct > 0 ? '▲' : '▼';
  return (
    <span className={cls}>
      {arrow} {Math.abs(pct).toFixed(1)}%{suffix && <span className="delta-suffix"> {suffix}</span>}
    </span>
  );
};

const Kpi = (props: { label: string; value: number; before: number; unit: string; digits?: number }) => {
  const { label, value, before, unit, digits = 0 } = props;
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">
        {value.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits })}
        <span className="kpi-unit">{unit}</span>
      </p>
      <Delta now={value} before={before} suffix="前週の同じ曜日から" />
    </div>
  );
};

const Card = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
  <div className="card">
    <div className="card-head">
      <h2>{title}</h2>
      {note && <p className="card-note">{note}</p>}
    </div>
    {children}
  </div>
);

/** 縦棒の共通部分：目盛り（横の細線）と、棒の並び */
const Columns = ({ max, children, labels }: { max: number; children: ReactNode; labels: ReactNode }) => {
  const scale = ticks(max);
  const top = scale[scale.length - 1] || 1;
  return (
    <div className="columns" style={{ ['--top' as string]: top }}>
      <div className="y-axis" aria-hidden>
        {scale.map((t) => (
          <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>
            {num(t)}
          </span>
        ))}
      </div>
      <div className="plot">
        {scale.map((t) => (
          <span key={t} className={t === 0 ? 'gridline is-base' : 'gridline'} style={{ bottom: `${(t / top) * 100}%` }} />
        ))}
        <div className="cols">{children}</div>
      </div>
      <div className="x-axis">{labels}</div>
    </div>
  );
};

const DailyChart = (props: {
  data: Summary['daily'];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}) => {
  const { data, selected, today, onSelect } = props;
  const max = Math.max(1, ...data.map((d) => d.count));
  const top = ticks(max).at(-1) || 1;
  return (
    <Columns
      max={max}
      labels={data.map((d) => (
        <span key={d.date} className={d.date === selected ? 'x is-selected' : 'x'}>
          {shortDate(d.date)}
          <small>{d.date === today ? '今日' : weekday(d.date)}</small>
        </span>
      ))}
    >
      {data.map((d) => (
        <button
          key={d.date}
          className={['col', d.date === selected && 'is-selected', d.date > today && 'is-future'].filter(Boolean).join(' ')}
          onClick={() => onSelect(d.date)}
          aria-label={`${formatDate(d.date)}：${num(d.count)}件`}
        >
          <span className="bar" style={{ height: `${(d.count / top) * 100}%` }} />
          <span className="tip">
            <b>{formatDate(d.date)}</b>
            予約 {num(d.count)}件 ・ 来店予定 {num(d.guests)}名{d.date > today && <em>受付中（今後増える見込み）</em>}
          </span>
        </button>
      ))}
    </Columns>
  );
};

const HourChart = ({ data }: { data: Summary['byHour'] }) => {
  const max = Math.max(1, ...data.flatMap((d) => [d.count, d.previous]));
  const top = ticks(max).at(-1) || 1;
  return (
    <>
      <ul className="legend inline">
        <li>
          <span className="swatch s-current" />
          この日
        </li>
        <li>
          <span className="swatch s-previous" />
          前週の同じ曜日
        </li>
      </ul>
      <Columns
        max={max}
        labels={data.map((d) => (
          <span key={d.hour} className="x">
            {d.hour}時
          </span>
        ))}
      >
        {data.map((d) => (
          <div key={d.hour} className="col pair" tabIndex={0} aria-label={`${d.hour}時台：${num(d.count)}件（前週 ${num(d.previous)}件）`}>
            <span className="bar s-previous" style={{ height: `${(d.previous / top) * 100}%` }} />
            <span className="bar s-current" style={{ height: `${(d.count / top) * 100}%` }} />
            <span className="tip">
              <b>{d.hour}時台</b>
              この日 {num(d.count)}件 ・ 前週 {num(d.previous)}件
              <Delta now={d.count} before={d.previous} suffix="" />
            </span>
          </div>
        ))}
      </Columns>
    </>
  );
};

const ChannelBreakdown = ({ data, total }: { data: Summary['byChannel']; total: number }) => {
  // 色は経路ごとに固定（件数の順で塗り替えない）
  const rows = CHANNEL_ORDER.map((channel) => {
    const count = data.find((d) => d.channel === channel)?.count ?? 0;
    return { channel, count, share: total ? count / total : 0 };
  });
  return (
    <div className="channels">
      <div className="stack" role="img" aria-label={rows.map((r) => `${CHANNEL_LABEL[r.channel]} ${Math.round(r.share * 100)}%`).join('、')}>
        {rows.map((r) => (
          <span key={r.channel} className={`segment ch-${r.channel}`} style={{ flexGrow: r.count }} />
        ))}
      </div>
      <ul className="legend">
        {rows.map((r) => (
          <li key={r.channel}>
            <span className={`swatch ch-${r.channel}`} />
            <span className="legend-name">{CHANNEL_LABEL[r.channel]}</span>
            <span className="legend-value">{num(r.count)}件</span>
            <span className="legend-share">{Math.round(r.share * 100)}%</span>
          </li>
        ))}
      </ul>
      <p className="hint">会員アプリの比率が上がるほど、電話受付の負担が減ります。</p>
    </div>
  );
};

const AreaBars = (props: {
  data: Summary['byArea'];
  selected: string | null;
  onSelect: (area: string | undefined) => void;
}) => {
  const { data, selected, onSelect } = props;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="areas">
      {data.map((d) => (
        <button
          key={d.area}
          className={selected === d.area ? 'area-row is-selected' : 'area-row'}
          onClick={() => onSelect(selected === d.area ? undefined : d.area)}
          title={selected === d.area ? '全エリアに戻す' : `${d.area}で絞り込む`}
        >
          <span className="area-name">{d.area}</span>
          <span className="area-track">
            <span className="area-bar" style={{ width: `${(d.count / max) * 100}%` }} />
          </span>
          <span className="area-value">{num(d.count)}件</span>
        </button>
      ))}
      {selected && (
        <button className="btn link" onClick={() => onSelect(undefined)}>
          全エリアに戻す
        </button>
      )}
    </div>
  );
};

const TopStores = ({ data }: { data: Summary['topStores'] }) => {
  const max = Math.max(1, ...data.map((d) => d.reservations));
  return (
    <div className="table-wrap">
      <table className="stores">
        <thead>
          <tr>
            <th>順位</th>
            <th>店舗</th>
            <th>エリア</th>
            <th className="right">予約件数</th>
            <th className="right">来店予定人数</th>
            <th className="right">前週の同じ曜日から</th>
          </tr>
        </thead>
        <tbody>
          {data.map((s, i) => (
            <tr key={s.storeId}>
              <td className="rank">{i + 1}</td>
              <td className="store-name">{s.name}</td>
              <td>
                <span className="chip">{s.area}</span>
              </td>
              <td className="right">
                <span className="inline-track">
                  <span className="inline-bar" style={{ width: `${(s.reservations / max) * 100}%` }} />
                </span>
                {num(s.reservations)}
              </td>
              <td className="right">{num(s.guests)}</td>
              <td className="right">
                <Delta now={s.reservations} before={s.previous} suffix="" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
