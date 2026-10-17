// cdk synth のあとに、環境ごとに「作られる AWS のリソースの数」と「設定ファイルの行数」を出す
//
// 【デモ1／基準1 期限】npx cdk synth '**' --quiet && npm run resources
//   「アプリが書いた約10行から、1環境あたり〇個のリソースと、約〇行の設定が作られます」（スライド26 の数字）
//   ・Dev/Dashboard（東京）と Dev/DashboardEdge（us-east-1：証明書と WAF）の合計。
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'cdk.out';
if (!existsSync(out)) {
  console.error(`${out} がありません。先に npx cdk synth '**' --quiet を実行してください`);
  process.exit(1);
}
const rows = [];
const ORDER = ['Dev', 'Stg', 'Prod'];
const dirs = readdirSync(out).filter((d) => d.startsWith('assembly-'));
dirs.sort((a, b) => ORDER.indexOf(a.slice(9)) - ORDER.indexOf(b.slice(9)));
for (const dir of dirs) {
  const env = dir.replace('assembly-', '');
  let resources = 0;
  let lines = 0;
  for (const f of readdirSync(join(out, dir)).filter((f) => f.endsWith('.template.json'))) {
    const text = readFileSync(join(out, dir, f), 'utf8');
    resources += Object.keys(JSON.parse(text).Resources ?? {}).length;
    lines += text.split('\n').length;
  }
  rows.push({ 環境: env, 'AWSのリソース': resources, '設定ファイルの行数': lines });
}
console.table(rows);
