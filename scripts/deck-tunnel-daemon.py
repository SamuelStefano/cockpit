#!/usr/bin/env python3
"""deck-tunnel-daemon — roda no DESKTOP do usuário (plano 20260626-deck-on-demand-tunnels).

O desktop está atrás de NAT, então é ELE quem abre o túnel. Faz poll na VPS (via SSH
forced-command `deck-tunnel relay`), e pra cada pedido pendente abre um túnel reverso
`ssh -N -R 127.0.0.1:PORT:127.0.0.1:LOCAL` e marca `ready`. Mata o filho no TTL — o
servidor também limita via `hold`, então a expiração é dupla. Cross-platform (precisa só
de python3 + cliente OpenSSH). Config em ~/.deck-tunnel/config.
"""
import json, os, subprocess, sys, time
from pathlib import Path

HOME = Path.home()
CFG = HOME / ".deck-tunnel" / "config"
LOG = HOME / ".deck-tunnel" / "daemon.log"

SSH_OPTS = [
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "ServerAliveInterval=15",
    "-o", "ServerAliveCountMax=3",
    "-o", "ExitOnForwardFailure=yes",
]


def log(msg: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, file=sys.stderr, flush=True)
    try:
        with open(LOG, "a") as f:
            f.write(line + "\n")
    except OSError:
        pass


def load_cfg() -> dict:
    cfg = {"POLL_SEC": "3", "KEY": str(HOME / ".deck-tunnel" / "id_ed25519")}
    for raw in CFG.read_text().splitlines():
        s = raw.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        cfg[k.strip()] = v.strip()
    for need in ("VPS_HOST", "VPS_USER"):
        if not cfg.get(need):
            sys.exit(f"config faltando {need} em {CFG}")
    return cfg


def ssh_control(cfg: dict, command: str) -> subprocess.CompletedProcess:
    # forced-command na VPS é `deck-tunnel relay`; o que queremos vai em SSH_ORIGINAL_COMMAND.
    args = ["ssh", "-i", cfg["KEY"], *SSH_OPTS, f'{cfg["VPS_USER"]}@{cfg["VPS_HOST"]}', command]
    return subprocess.run(args, capture_output=True, text=True, timeout=20)


active: dict = {}  # id -> {proc, deadline, port}


def open_tunnel(cfg: dict, req: dict) -> None:
    rid, rp, lp, ttl = req["id"], req["remotePort"], req["localPort"], req["ttlSec"]
    fwd = f"127.0.0.1:{rp}:127.0.0.1:{lp}"
    args = ["ssh", "-i", cfg["KEY"], "-N", "-R", fwd, *SSH_OPTS, f'{cfg["VPS_USER"]}@{cfg["VPS_HOST"]}']
    proc = subprocess.Popen(args)
    active[rid] = {"proc": proc, "deadline": time.time() + ttl, "port": rp}
    r = ssh_control(cfg, f"ready {rid} {rp}")
    if r.returncode != 0:
        log(f"ready {rid} falhou: {r.stderr.strip()[:80]}")
    log(f"túnel {rid} aberto :{rp}->:{lp} ttl={ttl}s")


def reap() -> None:
    now = time.time()
    for rid in list(active):
        a = active[rid]
        if a["proc"].poll() is not None:
            log(f"túnel {rid} caiu (porta {a['port']} ocupada?)")
            del active[rid]
        elif now >= a["deadline"]:
            a["proc"].terminate()
            log(f"túnel {rid} expirou (TTL) — fechando")
            del active[rid]


def main() -> None:
    cfg = load_cfg()
    poll = int(cfg.get("POLL_SEC", "3"))
    backoff = poll
    log(f"daemon up -> {cfg['VPS_USER']}@{cfg['VPS_HOST']} poll={poll}s")
    while True:
        try:
            r = ssh_control(cfg, "pop")
            if r.returncode != 0:
                log(f"pop falhou: {r.stderr.strip()[:80]} (backoff {backoff}s)")
                time.sleep(backoff)
                backoff = min(backoff * 2, 60)
                continue
            backoff = poll
            for req in json.loads(r.stdout.strip() or "[]"):
                if req["id"] in active:
                    continue
                try:
                    open_tunnel(cfg, req)
                except Exception as e:  # noqa: BLE001 — um pedido ruim não derruba o loop
                    log(f"abrir {req.get('id')} falhou: {e}")
            reap()
        except subprocess.TimeoutExpired:
            log("pop timeout")
        except Exception as e:  # noqa: BLE001
            log(f"loop err: {e}")
        time.sleep(poll)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
