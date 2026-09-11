#!/usr/bin/env bash
# Fast-forwards the Deck checkout to what was merged on GitHub. The drift check in
# doctor.sh compares the running process with the LOCAL HEAD, and nothing ever pulled
# origin: on 2026-09-10 PRs #544 and #545 stayed merged and off the air because the
# checkout stopped at #543. Only on `main`, only with a clean tree, only by
# fast-forward — a working branch or an edit in progress is never touched.
set -uo pipefail

REPO=${COCKPIT_REPO:-/home/samuel/cockpit}

[ "$(git -C "$REPO" rev-parse --abbrev-ref HEAD 2>/dev/null)" = "main" ] || exit 0
[ -z "$(git -C "$REPO" status --porcelain 2>/dev/null)" ] || exit 0
timeout 30 git -C "$REPO" fetch -q origin main 2>/dev/null || exit 0

local_head=$(git -C "$REPO" rev-parse HEAD)
remote_head=$(git -C "$REPO" rev-parse origin/main)
[ "$local_head" != "$remote_head" ] || exit 0
git -C "$REPO" merge-base --is-ancestor "$local_head" "$remote_head" || exit 0

git -C "$REPO" merge --ff-only -q origin/main 2>/dev/null || exit 0
echo "main advanced ${local_head:0:7} -> ${remote_head:0:7}"
