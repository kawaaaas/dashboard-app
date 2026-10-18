#!/usr/bin/env node
// =====================================================================================
// 【デモ1】ダッシュボードのインフラは、このファイルがすべてです
//
// 今の困りごと
//   ・新しい環境は、インフラ担当に依頼して2週間待っている。
//   ・インフラ担当は2名。9環境ぶんの作業（60人日）は、使える余力（40人日）を超える。
//
// ここで見ていただくこと
//   ・1環境あたり「箱（PlatformStage）を置く」「サービス（ApiService）を置く」の約10行だけ。
//   ・ネットワーク・暗号化・入口（CloudFront・WAF・証明書）・ログの設定は、1行も書いていない。
//   ・アプリチームが選ぶのは「画面があるか（site）」と「DBをどう使うか（db）」の2つだけ。
//
// これで解決すること
//   ・アプリチームが待たずに、その日のうちに環境を用意できる（2週間 → 1日以内）。
//   ・インフラ担当の工数は 60人日 → 約17人日。9環境は期限の1ヶ月以上前にそろう。
//   ・契約開始が1ヶ月遅れるごとに失う 1,000万円を守れる。
// =====================================================================================
import { ApiService, PlatformStage } from '@acme/platform';
import { App, aws_ecs as ecs } from 'aws-cdk-lib';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { applyExceptions } from '../exceptions';

const app = new App();
const image = ecs.ContainerImage.fromAsset('../app/api', { platform: Platform.LINUX_AMD64 }); // アプリのコンテナ
const site = { source: '../app/web/dist' }; // 画面のビルド結果

// ── 開発環境 ─────────────────────────────────────────────────────────────────
// 箱：この中に置いたものすべてに、チェックシートの検査が自動でかかる
const dev = new PlatformStage(app, 'Dev', { envType: 'dev' });
// サービス：これを1つ書くと、裏側で 43個の AWS リソース（約2,000行の設定）が作られる
const devApi = new ApiService(dev, 'Dashboard', {
  service: 'dashboard', // URL は https://dashboard-dev.<ドメイン> になる
  image, //               アプリのコンテナ
  site, //                画面がある → API と同じドメインで配信する（API は /api/*）
  db: 'readExisting', //  共有の予約DBを、読み取り専用のユーザーで使う
}); //                    WAF・HTTPS・証明書・ログは、書かなくても部品の標準で付く

// -------------------------------------------------------------------------------------
// 【デモ2】試すこと1：危険な設定は、反映する前に止まるか
//
// 今の困りごと
//   ・障害の調査などで、善意から「手元からDBにつなぎたい」という変更が入る。
//   ・いまは 60項目 × 9環境を人が目で確かめている。見落とせば、そのまま本番に出る。
//
// 試すこと
//   ・下の1行のコメントを外す（DBのポートをインターネットに開ける）→ npx cdk synth '**' --quiet
//
// 起きること
//   ・ERROR Checksheet-INF-18（インターネットからDBへの接続を許可しない）で止まり、AWS に届かない。
//   ・アプリチームは検査の設定を何も書いていない。箱に置いた時点で、変更のたびに必ずかかる。
//   ・PR でも同じ検査が必須。違反した PR は赤くなり、マージできない（PR #1）。
// -------------------------------------------------------------------------------------
// devApi.dbConnections.allowDefaultPortFromAnyIpv4();

// ── 検証環境 ─────────────────────────────────────────────────────────────────
// 書き方は開発環境と同じ。箱の envType を変えるだけで、検証環境の既定値（2タスク・Multi-AZ）になる
const stg = new PlatformStage(app, 'Stg', { envType: 'stg' });
const stgApi = new ApiService(stg, 'Dashboard', {
  service: 'dashboard',
  image,
  site,
  db: 'readExisting',
  // -----------------------------------------------------------------------------------
  // 【デモ2】試すこと2：理由のある例外は、通せるか
  //
  // 今の困りごと
  //   ・「検証環境はコストのため1タスクで」のような要望は、必ず出てくる。
  //   ・すべてを止めると、現場が回らなくなる。
  //
  // 試すこと
  //   ・下の1行のコメントを外す → INF-41（検証・本番は2タスク以上で動かす）で止まる。
  //   ・続けて infra/exceptions.ts に理由を書くと、通る（そちらのファイルへ）。
  // -----------------------------------------------------------------------------------
  // minTasks: 1,
});

// ── 本番環境 ─────────────────────────────────────────────────────────────────
// 必要なところだけ上書きできる（本番だけ、タスクの上限を引き上げている）
const prod = new PlatformStage(app, 'Prod', { envType: 'prod' });
const prodApi = new ApiService(prod, 'Dashboard', {
  service: 'dashboard',
  image,
  site,
  db: 'readExisting',
  maxTasks: 10,
});

// ルールの例外は infra/exceptions.ts にだけ書く（インフラチームのレビューが必須のファイル）
applyExceptions({ dev: devApi, stg: stgApi, prod: prodApi });
