#!/usr/bin/env bash
# PR のコメントを、種類ごとに1つだけ保つ（あれば書き換え、なければ作る）。
#   使い方: upsert-comment.sh <PR番号> <種類> <本文のファイル>
#   本文の先頭に <!-- 種類 --> の目印を付け、同じ目印のコメントを探して書き換える。
set -euo pipefail
pr="$1" kind="$2" file="$3"
marker="<!-- $kind -->"
body="$(printf '%s\n%s' "$marker" "$(cat "$file")")"
id="$(gh api "repos/$GITHUB_REPOSITORY/issues/$pr/comments" --paginate \
  -q ".[] | select(.body | startswith(\"$marker\")) | .id" | tail -1)"
if [ -n "$id" ]; then
  gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$id" -f body="$body" > /dev/null
else
  gh pr comment "$pr" --body "$body"
fi
