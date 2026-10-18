#!/usr/bin/env node
// =====================================================================================
// 【デモ1／基準1 期限】このファイルが、ダッシュボードのインフラのすべて（スライド25「アプリが書くコード」）
//
//   見ていただく点① アプリ側が書くのは約10行
//     ・1環境あたり「箱（PlatformStage）を置く」「サービス（ApiService）を置く」の約10行だけ。
//     ・暗号化・ネットワーク・入口（CloudFront・WAF・証明書）・ログの設定は、1行も書いていない。
//       すべて部品の既定値で、インフラチームの標準どおりになる。
//     ・アプリ側が選ぶのは「画面があるか（site）」「DBをどう使うか（db）」だけ。
// =====================================================================================
import { ApiService, PlatformStage } from '@acme/platform';
import { App, aws_ecs as ecs } from 'aws-cdk-lib';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { applyExceptions } from '../exceptions';

const app = new App();
const image = ecs.ContainerImage.fromAsset('../app/api', { platform: Platform.LINUX_AMD64 }); // アプリのコンテナ
const site = { source: '../app/web/dist' }; // 画面のビルド結果

// 開発環境 ─ 【デモ1 ①】1環境あたり、これだけのコードで、インフラのすべてが書ける
const dev = new PlatformStage(app, 'Dev', { envType: 'dev' }); // 箱：中に置いたものに、チェックシートの検査が自動でかかる
const devApi = new ApiService(dev, 'Dashboard', {
  service: 'dashboard', // URL は https://dashboard-dev.<ドメイン> になる
  image,
  site, //                 画面がある → 同じドメインで配信し、API は /api/*
  db: 'readExisting', //   共有の予約DBを、読み取り専用のユーザーで使う
}); //                     入口の WAF・HTTPS・証明書は、書かなくても部品の標準で付く

// -------------------------------------------------------------------------------------
// 【デモ2／基準2 セキュリティ】試すこと1：見ていただく点① 危険な設定は、反映前の検査で止まる（スライド29）
//   ・「調査のため、手元からDBにつなぎたい」という、現場でありがちな1行。
//   ・コメントを外して npx cdk synth '**' --quiet → 「ERROR Checksheet-INF-18」で止まる。
//     チェックシート INF-18「インターネットからDBへの接続を許可しない」に違反したので、AWS に届く前に止まった。
//   ・アプリチームは検査の設定を何もしていない。ルールは部品（PlatformStage）に入っていて、変更のたびに必ずかかる。
//     人が目で確かめなくてよい。PR でもこの検査が必須になっていて、赤いままではマージできない（PR #1）。
//   ・終わったらコメントに戻す（git checkout -- .）。
// -------------------------------------------------------------------------------------
// devApi.dbConnections.allowDefaultPortFromAnyIpv4();

// 検証環境 ─ 書き方は開発環境と同じ。箱の envType を変えるだけで、検証環境の既定値（2タスクなど）になる
const stg = new PlatformStage(app, 'Stg', { envType: 'stg' });
const stgApi = new ApiService(stg, 'Dashboard', {
  service: 'dashboard',
  image,
  site,
  db: 'readExisting',
  // -----------------------------------------------------------------------------------
  // 【デモ2／基準2 セキュリティ】試すこと2：見ていただく点② 例外は、理由を書けば通る（スライド29）
  //   ・「コストのため、検証環境は1タスクで動かしたい」という、現場で必ず起きる要望。
  //   ・コメントを外して synth → 「ERROR Checksheet-INF-41」（検証・本番は2タスク以上）で止まる。
  //   ・続けて infra/exceptions.ts に理由を書くと通る（そちらのコメントへ）。
  // -----------------------------------------------------------------------------------
  // minTasks: 1,
});

// 本番環境 ─ 必要なところだけ上書きできる（本番だけタスクの上限を引き上げ）
const prod = new PlatformStage(app, 'Prod', { envType: 'prod' });
const prodApi = new ApiService(prod, 'Dashboard', {
  service: 'dashboard',
  image,
  site,
  db: 'readExisting',
  maxTasks: 10,
});

// ルールの例外は infra/exceptions.ts にだけ書く（インフラのレビューが必須のファイル）
applyExceptions({ dev: devApi, stg: stgApi, prod: prodApi });
