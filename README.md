# dashboard-app

店舗向けの「今日の予約状況」ダッシュボードです。アプリチームが書くインフラは `infra/bin/app.ts` の数行だけで、入口（CloudFront・WAF・証明書）・VPC・DB・ログなどはインフラ部品（`@acme/platform`）が用意します。

開発環境の URL は `https://dashboard-dev.<ドメイン>` です。画面と API は同じドメインで、API は `/api/*` です。

```
app/api   API（Hono + pg）。/health と /api/summary?date=YYYY-MM-DD
app/web   画面（Vite + React）。起動時に /config.json を読む（本番では API は同じドメインの /api/*）
infra     部品を呼ぶだけの CDK アプリ（Dev / Stg / Prod）
```

## ローカルで動かす（AWS 不要）

DB_HOST を設定しなければ、API はダミーデータで返します。

```bash
cd app/api && npm ci && npm run dev     # http://localhost:8080
cd app/web && npm ci && npm run dev     # http://localhost:5173
```

## インフラの準備

`@acme/platform` は CodeArtifact から入れます（12 時間有効）。

```bash
aws codeartifact login --tool npm --domain acme --repository platform --namespace acme
cd app/web && npm ci && npm run build   # 部品が dist を S3 に置くので先にビルドする
cd infra && npm i                       # 初回は package-lock.json がここで作られる
```

## ルールの検査

```bash
cd infra
npx cdk synth '**' --quiet     # Stage の中のスタックも全部検査。違反があれば exit 1
npx acme-checksheet            # 環境ごとの 違反 / 例外 / 準拠 の一覧
npm run resources              # 環境ごとの AWS のリソース数と設定ファイルの行数
npx acme-checksheet --markdown --exceptions-only
```

`cdk synth` だけ（`'**'` なし）だと Stage の中のスタックは検査されないので注意してください。

## デプロイ

`main` への push で GitHub Actions が開発環境だけをデプロイします（`.github/workflows/deploy.yml`）。`Dev/Dashboard`（東京）と、証明書と WAF の入った `Dev/DashboardEdge`（us-east-1）の2つです。Stg / Prod は synth（検査）のみです。手元から入れる場合：

```bash
npx cdk deploy 'Dev/*'
```

## デモ用の変更

デモで使う行は、コメントにして置いてあります（`【デモ2】` で検索）。コメントを外して `npx cdk synth '**' --quiet` を実行します。終わったら `git checkout -- .` で戻します。

| 場所 | 行 | 結果 |
| --- | --- | --- |
| `infra/bin/app.ts`（開発環境） | `devApi.dbConnections.allowDefaultPortFromAnyIpv4();` | INF-18（インターネットからDBへの接続を許可しない）で止まる |
| `infra/bin/app.ts`（検証環境） | `minTasks: 1,` | INF-41（検証・本番は2タスク以上で動かす）で止まる |
| `infra/exceptions.ts` | `addException(apis.stg, 'INF-41', '…')` | 例外として通る。PR には「例外あり」ラベルと例外の一覧が付く |

`infra/exceptions.ts` は CODEOWNERS でインフラ側のレビューが必須です。

## GitHub 側の設定

- リポジトリ変数 `AWS_ACCOUNT_ID`
- `infra/cdk.context.json`（初回の synth で作られる VPC などの検索結果）はコミットする
  - 検証・本番は synth だけで AWS に VPC を作っていないため、`acme-stg`・`acme-prod` の VPC は lookup の結果を固定した仮の値（開発環境の値を写して ID と CIDR を変えたもの）
- ラベル `例外あり`
- ブランチ保護（main）：`check` を必須チェックにする、CODEOWNERS のレビューを必須にする

## 部品の版を上げる

```bash
cd infra
scripts/upgrade-platform.sh 1.1.0
```

ブランチを切って版を固定で入れ、synth とチェックシートで確かめてから PR を作ります。取り込む時期はこのチームが決めます。
デプロイ済みの環境と何が変わるかは、ブランチで `npx cdk diff 'Dev/*'` を流して確かめます。
