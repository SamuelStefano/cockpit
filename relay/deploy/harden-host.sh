#!/usr/bin/env bash
# Hardens the relay VPS and moves the relay to the sandboxed layout. Runs ON the
# host as root, after build.sh's output was copied to /tmp/deck-relay/:
#
#   relay/deploy/build.sh
#   scp -i ~/.ssh/oracle_relay relay/deploy/dist/* relay/deploy/{deck-relay.service,Caddyfile,harden-host.sh} ubuntu@HOST:/tmp/deck-relay/
#   ssh -i ~/.ssh/oracle_relay ubuntu@HOST 'sudo bash /tmp/deck-relay/harden-host.sh'
#
# Idempotent. Every step that can lock the relay out validates first and rolls
# back on failure. It never touches the firewall or port 22.
set -euo pipefail

SRC=/tmp/deck-relay
NODE_VERSION=${NODE_VERSION:-v22.22.2}
NODE_DIR=/opt/node22
APP=/opt/deck-relay
ETC=/etc/deck-relay
OLD_ENV=${OLD_ENV:-/home/ubuntu/cockpit/.env.relay}
BACKUP=/root/deck-relay-backup-$(date +%Y%m%d-%H%M%S)

log() { printf '\n== %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "run as root"
for f in main.mjs main.mjs.sha256 REVISION deck-relay.service Caddyfile; do [ -f "$SRC/$f" ] || die "missing $SRC/$f"; done
[ "$(sha256sum "$SRC/main.mjs" | cut -d' ' -f1)" = "$(cat "$SRC/main.mjs.sha256")" ] || die "bundle checksum mismatch"

log "backup -> $BACKUP"
mkdir -p "$BACKUP" && chmod 700 "$BACKUP"
cp -a /etc/systemd/system/deck-relay.service "$BACKUP/" 2>/dev/null || true
cp -a /etc/caddy/Caddyfile "$BACKUP/" 2>/dev/null || true
[ -f "$OLD_ENV" ] && cp -a "$OLD_ENV" "$BACKUP/env.relay"

log "node $NODE_VERSION (official tarball, checksum-verified)"
arch=$(uname -m); case "$arch" in x86_64) narch=x64 ;; aarch64) narch=arm64 ;; *) die "arch $arch" ;; esac
if [ "$("$NODE_DIR/bin/node" --version 2>/dev/null || true)" != "$NODE_VERSION" ]; then
  tmp=$(mktemp -d)
  tarball="node-$NODE_VERSION-linux-$narch.tar.xz"
  curl -fsSLo "$tmp/$tarball" "https://nodejs.org/dist/$NODE_VERSION/$tarball"
  curl -fsSLo "$tmp/SHASUMS256.txt" "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt"
  (cd "$tmp" && grep " $tarball\$" SHASUMS256.txt | sha256sum -c -) || die "node checksum mismatch"
  rm -rf "$NODE_DIR.new" && mkdir -p "$NODE_DIR.new"
  tar -xJf "$tmp/$tarball" -C "$NODE_DIR.new" --strip-components=1
  rm -rf "$NODE_DIR" && mv "$NODE_DIR.new" "$NODE_DIR"
  chown -R root:root "$NODE_DIR" && chmod -R go-w "$NODE_DIR"
  rm -rf "$tmp"
fi

log "user relay (no shell, no home, no sudo)"
id relay >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin relay

log "code: root-owned, read-only to relay"
mkdir -p "$APP" && chown root:root "$APP" && chmod 755 "$APP"
install -o root -g root -m 0644 "$SRC/main.mjs" "$APP/main.mjs.new"
install -o root -g root -m 0644 "$SRC/REVISION" "$APP/REVISION"
mv "$APP/main.mjs.new" "$APP/main.mjs"

log "env: root:relay 0640"
mkdir -p "$ETC" && chown root:relay "$ETC" && chmod 750 "$ETC"
if [ ! -f "$ETC/env" ]; then
  [ -f "$OLD_ENV" ] || die "no $ETC/env and no $OLD_ENV to migrate"
  install -o root -g relay -m 0640 "$OLD_ENV" "$ETC/env"
fi
for kv in ${EXTRA_ENV:-}; do
  k=${kv%%=*}
  grep -v "^$k=" "$ETC/env" > "$ETC/env.tmp" || true
  echo "$kv" >> "$ETC/env.tmp"
  install -o root -g relay -m 0640 "$ETC/env.tmp" "$ETC/env" && rm -f "$ETC/env.tmp"
done
chown root:relay "$ETC/env" && chmod 640 "$ETC/env"

log "systemd unit + smoke test (rollback on failure)"
install -o root -g root -m 0644 "$SRC/deck-relay.service" /etc/systemd/system/deck-relay.service
systemctl daemon-reload
systemctl restart deck-relay
ok=0
for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8800/status 2>/dev/null | grep -q '"ok":true'; then ok=1; break; fi
  sleep 1
done
if [ "$ok" != 1 ]; then
  journalctl -u deck-relay -n 40 --no-pager || true
  echo "ROLLBACK: restoring previous unit"
  cp -a "$BACKUP/deck-relay.service" /etc/systemd/system/deck-relay.service
  systemctl daemon-reload && systemctl restart deck-relay
  die "new relay did not come up; previous unit restored"
fi
echo "relay up at $(cat "$APP/REVISION")"

log "caddy: token-free logs, admin on a unix socket"
mkdir -p /run/caddy && chown caddy:caddy /run/caddy 2>/dev/null || true
install -d -o root -g root -m 0755 /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/runtime-dir.conf <<'EOF'
[Service]
RuntimeDirectory=caddy
RuntimeDirectoryPreserve=yes
EOF
systemctl daemon-reload
if caddy validate --config "$SRC/Caddyfile" --adapter caddyfile >/dev/null 2>&1; then
  install -o root -g root -m 0644 "$SRC/Caddyfile" /etc/caddy/Caddyfile
  # The admin address moves, so a reload through the old one would not apply it.
  systemctl restart caddy
  sleep 2
  if ! curl -fsS https://deck-relay.devfellowship.com/status >/dev/null; then
    echo "ROLLBACK: restoring previous Caddyfile"
    cp -a "$BACKUP/Caddyfile" /etc/caddy/Caddyfile && systemctl restart caddy
    die "caddy did not serve /status with the new config; previous config restored"
  fi
else
  caddy validate --config "$SRC/Caddyfile" --adapter caddyfile || true
  die "new Caddyfile does not validate; nothing changed in caddy"
fi

log "journald: drop old logs (they held JWTs in URLs), cap retention"
install -d -m 0755 /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/90-deck-relay.conf <<'EOF'
[Journal]
SystemMaxUse=500M
MaxRetentionSec=14day
EOF
systemctl restart systemd-journald
journalctl --vacuum-time=1d >/dev/null || true

log "rpcbind off"
systemctl disable --now rpcbind.socket rpcbind.service 2>/dev/null || true

log "sshd: no X11/agent forwarding (validated before reload)"
cat > /etc/ssh/sshd_config.d/90-deck-hardening.conf <<'EOF'
X11Forwarding no
AllowAgentForwarding no
EOF
if sshd -t; then systemctl reload ssh 2>/dev/null || systemctl reload sshd; else rm -f /etc/ssh/sshd_config.d/90-deck-hardening.conf; die "sshd config invalid; reverted"; fi

log "old layout"
echo "The old checkout at /home/ubuntu/cockpit is no longer used by the service."
echo "Its .env.relay still holds the service-role key: remove it once you are happy:"
echo "  shred -u $OLD_ENV"
echo
echo "DONE. Backup in $BACKUP. Pending reboot for kernel/libc: $( [ -f /var/run/reboot-required ] && echo yes || echo no )"
