#!/usr/bin/env bash
# 部品（@acme/platform）の版を上げる PR を作る。取り込む時期は、このチームが決める。
#   使い方: scripts/upgrade-platform.sh <版>   例：scripts/upgrade-platform.sh 1.1.0
# ブランチを切って版を固定で入れ、synth とチェックシートで確かめてから PR を作る。
# デプロイ済みの環境と何が変わるかは、`npx cdk diff 'Dev/*'` で確かめられる。
set -euo pipefail
cd "$(dirname "$0")/.."

version="${1:-}"
[ -n "$version" ] || { echo "使い方: $0 <版>（例：1.1.0）" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "コミットしていない変更があります" >&2; exit 1; }

# CodeArtifact のトークン（12時間有効）が切れていれば取り直す
npm view "@acme/platform@$version" version > /dev/null 2>&1 ||
  aws codeartifact login --tool npm --domain acme --repository platform --namespace acme
npm view "@acme/platform@$version" version > /dev/null || { echo "@acme/platform@$version は公開されていません" >&2; exit 1; }

branch="deps/platform-$version"
git switch main --quiet && git pull --ff-only --quiet
git switch -c "$branch"
npm install --save-exact "@acme/platform@$version"

npx cdk synth '**' --quiet
npx acme-checksheet

git commit -am "部品を $version に更新する"
git push -u origin "$branch"
gh pr create --title "部品を $version に更新する" \
  --body "変更点は platform-constructs の v$version のリリースを参照。PR の check で検査の結果を確かめる。"
