#!/usr/bin/env python3
"""Follow a Claude Code transcript (JSONL) and print it as a plain terminal log.

Runs inside a tmux pane opened by the canvas: one line per user prompt, assistant
text, tool call and tool result, then keeps following the file as the session
writes it. Python on purpose: a stdlib process costs ~10 MB of RSS against ~45 MB
for node, and the canvas can keep several of these open on a 4 GB box.
"""
import collections
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone

RESET = "\x1b[0m"
DIM = "\x1b[2m"
BOLD = "\x1b[1m"
ORANGE = "\x1b[38;5;208m"
GREEN = "\x1b[32m"
CYAN = "\x1b[36m"
RED = "\x1b[31m"
YELLOW = "\x1b[33m"

BACKLOG_LINES = 400
POLL_S = 0.5
MAX_RESULT_LINES = 6
MAX_TEXT_CHARS = 4000


# Transcript text is untrusted (tool results carry web pages, files, command
# output): a raw ESC or C1 byte printed here would be executed by tmux/xterm as
# a control sequence. Only our own colour codes may reach the terminal.
CONTROL = re.compile("[\x00-\x08\x0b-\x1f\x7f-\x9f]")


def clip(s, n):
    s = CONTROL.sub("", s)
    return s if len(s) <= n else s[: n - 1] + "…"


def tool_arg(name, inp):
    if not isinstance(inp, dict):
        return ""
    for key in ("command", "file_path", "pattern", "path", "url", "query", "description", "prompt", "skill"):
        v = inp.get(key)
        if isinstance(v, str) and v:
            return clip(v.split("\n")[0], 160)
    return clip(json.dumps(inp, ensure_ascii=False), 160)


def result_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text")
    return ""


BRT = timezone(timedelta(hours=-3))


def stamp(rec):
    ts = rec.get("timestamp")
    if not isinstance(ts, str):
        return ""
    try:
        t = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(BRT)
    except ValueError:
        return ""
    return DIM + t.strftime("%H:%M:%S") + " " + RESET


# Harness-injected blocks (slash commands, reminders, hook output) ride in the
# user role but were never typed by the user.
INJECTED = re.compile(r"^<(command-|local-command-|system-reminder|task-notification|bash-|user-prompt-submit-hook)")


def typed(text):
    return text.strip() and not INJECTED.match(text.lstrip())


def render(rec):
    if not isinstance(rec, dict):
        return []
    kind = rec.get("type")
    msg = rec.get("message")
    content = msg.get("content") if isinstance(msg, dict) else None
    out = []
    if kind == "user":
        if isinstance(content, str):
            if not typed(content):
                return out
            out.append("")
            out.append(stamp(rec) + BOLD + ORANGE + "❯ " + RESET + BOLD + clip(content.strip(), MAX_TEXT_CHARS) + RESET)
            return out
        for c in content if isinstance(content, list) else []:
            if not isinstance(c, dict):
                continue
            if c.get("type") == "text" and isinstance(c.get("text"), str) and typed(c["text"]):
                out.append("")
                out.append(stamp(rec) + BOLD + ORANGE + "❯ " + RESET + BOLD + clip(c["text"].strip(), MAX_TEXT_CHARS) + RESET)
            elif c.get("type") == "tool_result":
                lines = [l for l in result_text(c.get("content")).split("\n") if l.strip()]
                color = RED if c.get("is_error") else DIM
                for l in lines[:MAX_RESULT_LINES]:
                    out.append(color + "  │ " + clip(l, 200) + RESET)
                if len(lines) > MAX_RESULT_LINES:
                    out.append(DIM + "  │ … +%d linhas" % (len(lines) - MAX_RESULT_LINES) + RESET)
    elif kind == "assistant":
        for c in content if isinstance(content, list) else []:
            if not isinstance(c, dict):
                continue
            t = c.get("type")
            if t == "text" and c.get("text", "").strip():
                out.append(stamp(rec) + GREEN + "● " + RESET + clip(c["text"].strip(), MAX_TEXT_CHARS))
            elif t == "thinking":
                out.append(stamp(rec) + DIM + "✻ pensando…" + RESET)
            elif t == "tool_use":
                name = clip(str(c.get("name", "?")), 60)
                out.append(stamp(rec) + CYAN + "⏺ " + name + RESET + " " + tool_arg(name, c.get("input")))
    elif kind == "system" and rec.get("subtype") == "compact_boundary":
        out.append(YELLOW + "── contexto compactado ──" + RESET)
    return out


def emit(lines):
    if lines:
        sys.stdout.write("\n".join(l.replace("\n", "\r\n") for l in lines) + "\r\n")
        sys.stdout.flush()


def parse(line):
    try:
        return json.loads(line)
    except ValueError:
        return None


def main():
    if len(sys.argv) != 2:
        print("uso: session-tail.py <transcript.jsonl>")
        return 2
    path = sys.argv[1]
    sid = os.path.basename(path).removesuffix(".jsonl")
    sys.stdout.write(DIM + "sessão " + sid + " · ctrl-c → shell · claude --resume " + sid + RESET + "\r\n")
    while not os.path.exists(path):
        time.sleep(POLL_S)
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        # Bounded: only the last BACKLOG_LINES are ever shown, and a full list held
        # every rendered line of a transcript that can be hundreds of MB.
        backlog = collections.deque(maxlen=BACKLOG_LINES)
        pending = ""
        for line in f:
            if not line.endswith("\n"):
                pending = line  # the writer is mid-record; finish it while following
                break
            rec = parse(line)
            if rec:
                backlog.extend(render(rec))
        emit(list(backlog))
        sys.stdout.write(DIM + "── ao vivo ──" + RESET + "\r\n")
        sys.stdout.flush()
        while True:
            chunk = f.readline()
            if not chunk:
                time.sleep(POLL_S)
                continue
            pending += chunk
            if not pending.endswith("\n"):
                continue
            rec = parse(pending)
            pending = ""
            if rec:
                emit(render(rec))


if __name__ == "__main__":
    try:
        sys.exit(main() or 0)
    except KeyboardInterrupt:
        sys.stdout.write("\r\n")
