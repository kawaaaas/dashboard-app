import { existsSync, readFileSync } from 'fs';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Pool } from 'pg';
import { fixture } from './fixture';
import { summarize } from './summary';

/**
 * 本部向けダッシュボードの集計API。
 * 部品（@acme/platform）との約束：8080番で待ち受ける／/health で200を返す／DBの接続情報は環境変数で受け取る。
 */
const CA_BUNDLE = '/app/rds-ca.pem';

const pool = process.env.DB_HOST
  ? new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 5,
      // RDS の CA 証明書で接続先を検証する（Dockerfile で取得）
      ssl: existsSync(CA_BUNDLE) ? { ca: readFileSync(CA_BUNDLE, 'utf8') } : { rejectUnauthorized: false },
    })
  : undefined;

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = new Hono();

app.use('/api/*', cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : '*', allowMethods: ['GET'] }));

app.get('/health', (c) => c.text('ok'));

app.get('/api/summary', async (c) => {
  const date = c.req.query('date');
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ message: 'date は YYYY-MM-DD で指定してください' }, 400);
  }
  if (!pool) return c.json(fixture(date));
  try {
    return c.json(await summarize(pool, date));
  } catch (error) {
    console.error(error);
    return c.json({ message: '集計に失敗しました' }, 500);
  }
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => {
  console.log(`dashboard-api listening on ${port} (${pool ? 'database' : 'fixture'})`);
});
