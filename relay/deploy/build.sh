#!/usr/bin/env bash
# Builds the relay into ONE self-contained file. The host then runs plain
# `node main.mjs`: no npx, no tsx, no node_modules and no npm install on the
# relay box, so nothing on it can be swapped by a package script.
set -euo pipefail
cd "$(dirname "$0")/../.."
out=relay/deploy/dist
rm -rf "$out" && mkdir -p "$out"
# ws loads bufferutil/utf-8-validate optionally; without them it uses its JS path.
npx esbuild relay/src/main.ts --bundle --platform=node --target=node22 --format=esm \
  --external:bufferutil --external:utf-8-validate \
  --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" \
  --outfile="$out/main.mjs" --log-level=warning
# Operator CLI (diag_reports), same self-contained form: node diag-reports.mjs.
npx esbuild relay/scripts/diag-reports.ts --bundle --platform=node --target=node22 --format=esm \
  --outfile="$out/diag-reports.mjs" --log-level=warning
git rev-parse HEAD > "$out/REVISION"
sha256sum "$out/main.mjs" | cut -d' ' -f1 > "$out/main.mjs.sha256"
echo "built $(cat "$out/REVISION") sha256=$(cat "$out/main.mjs.sha256")"
