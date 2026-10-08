#!/usr/bin/env python3
"""Export Claude Code session transcripts into making-of/sessions/*.json.

Reads the local Claude Code transcripts for this repo (~/.claude/projects/<cwd>/*.jsonl)
and writes one sanitized JSON file per session: every human prompt verbatim, Claude's
visible replies, tool-call counts, token usage, API-equivalent cost, and the commits
made during each turn. Tool outputs, system prompts and thinking are NOT exported.

Python 3 stdlib only. Safe to run repeatedly: a session file is rewritten from the
full transcript each time, and sessions whose transcript is gone are left untouched.

Usage: python3 tools/ai_log.py            # export every transcript found for this repo
       python3 tools/ai_log.py --hook     # same, but never fail (for Claude Code hooks)
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "making-of" / "sessions"

# USD per million tokens (Anthropic first-party API list prices).
# Cache writes: 5-minute TTL = 1.25x input, 1-hour TTL = 2x input.
PRICES = {
    "claude-opus-5-5": {"in": 4.00, "out": 20.00, "cache_read": 0.20},
    "claude-sonnet-5-5": {"in": 2.00, "out": 10.00, "cache_read": 0.20},
    "claude-haiku-5-5": {"in": 0.10, "out": 0.50, "cache_read": 0.01},
    "claude-fable-5-1": {"in": 10.00, "out": 50.00, "cache_read": 0.25},
    "claude-opus-5": {"in": 5.00, "out": 25.00, "cache_read": 0.50},
    "claude-sonnet-5": {"in": 2.00, "out": 10.00, "cache_read": 0.20},
}

# Readings within this many seconds of a turn's first model response still reflect usage from
# before the turn (concurrent work while the session was idle), so they count as its baseline.
BASELINE_GRACE_S = 10

REMINDER_RE = re.compile(r"<system-reminder>.*?</system-reminder>", re.S)


def transcripts_dir():
    escaped = re.sub(r"[^A-Za-z0-9]", "-", str(ROOT))
    return Path.home() / ".claude" / "projects" / escaped


def parse_ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def prompt_text(entry):
    """Return the human prompt text for a user entry, or None if it isn't one."""
    if entry.get("type") != "user" or entry.get("isMeta") or entry.get("isSidechain"):
        return None
    origin = entry.get("origin") or {}
    if origin and origin.get("kind") != "human":
        return None
    content = entry.get("message", {}).get("content")
    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        if any(isinstance(c, dict) and c.get("type") == "tool_result" for c in content):
            return None
        text = "\n".join(c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text")
    else:
        return None
    text = REMINDER_RE.sub("", text).strip()
    if not text or text.startswith("<command-") or text.startswith("<local-command"):
        return None
    return text


def empty_usage():
    return {"input": 0, "cache_write_5m": 0, "cache_write_1h": 0, "cache_read": 0, "output": 0, "thinking": 0}


def add_usage(acc, u):
    cc = u.get("cache_creation") or {}
    w5 = cc.get("ephemeral_5m_input_tokens")
    w1 = cc.get("ephemeral_1h_input_tokens")
    if w5 is None and w1 is None:
        w5, w1 = u.get("cache_creation_input_tokens", 0), 0
    acc["input"] += u.get("input_tokens", 0) or 0
    acc["cache_write_5m"] += w5 or 0
    acc["cache_write_1h"] += w1 or 0
    acc["cache_read"] += u.get("cache_read_input_tokens", 0) or 0
    acc["output"] += u.get("output_tokens", 0) or 0
    acc["thinking"] += (u.get("output_tokens_details") or {}).get("thinking_tokens", 0) or 0


def cost(model, u):
    p = PRICES.get(model)
    if not p:
        return None
    return (
        u["input"] * p["in"]
        + u["cache_write_5m"] * p["in"] * 1.25
        + u["cache_write_1h"] * p["in"] * 2
        + u["cache_read"] * p["cache_read"]
        + u["output"] * p["out"]
    ) / 1e6


def git_commits():
    try:
        out = subprocess.run(
            ["git", "log", "--all", "--format=%H%x09%cI%x09%s"],
            cwd=ROOT, capture_output=True, text=True, check=True,
        ).stdout
    except Exception:
        return []
    commits = []
    for line in out.splitlines():
        parts = line.split("\t", 2)
        if len(parts) == 3:
            commits.append({"sha": parts[0], "time": parse_ts(parts[1]), "subject": parts[2]})
    return commits


def plan_snapshots(entries):
    """Plan-usage snapshots from `rate_limit_event`s fetched with the claude-code-remote
    `list_events` tool. The events only live in the cloud session's event stream, so Claude
    fetches them each turn (see CLAUDE.md) and the tool result lands in the transcript."""
    snaps = {}
    for e in entries:
        content = e.get("message", {}).get("content") if e.get("type") == "user" else None
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict) or block.get("type") != "tool_result":
                continue
            raw = block.get("content")
            texts = [raw] if isinstance(raw, str) else [
                c.get("text", "") for c in (raw or []) if isinstance(c, dict)]
            for text in texts:
                if "rate_limit_info" not in text:
                    continue
                try:
                    data = json.loads(text)
                except json.JSONDecodeError:
                    continue
                for ev in (data.get("ccr") or data).get("data", []):
                    rle = ev.get("rate_limit_event") or {}
                    body = rle.get("internal_anthropic_catchall") or rle
                    info = body.get("rate_limit_info")
                    if not info or not ev.get("created_at"):
                        continue
                    windows = info.get("unifiedWindows") or {}
                    snap = {"at": ev["created_at"], "status": info.get("status")}
                    for name in ("five_hour", "seven_day"):
                        w = windows.get(name)
                        if w:
                            snap[name] = w.get("utilization")
                            snap[name + "_resets_at"] = w.get("resetsAt")
                    snaps[rle.get("uuid") or ev["created_at"]] = snap
    return sorted(snaps.values(), key=lambda x: x["at"])


def load_entries(path):
    entries = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return entries


def export_session(path, commits):
    entries = load_entries(path)
    # Subagent transcripts (if any) live next to the main file; their usage counts too.
    sub_dir = path.with_suffix("")
    sub_entries = []
    if sub_dir.is_dir():
        for p in sorted(sub_dir.rglob("*.jsonl")):
            sub_entries.extend(load_entries(p))

    session_id = path.stem
    title = None
    reported = None
    turns = []
    cur = None
    seen_msgs = {}

    def close(turn):
        if turn:
            turns.append(turn)

    for e in entries:
        t = e.get("type")
        if t == "ai-title":
            title = e.get("aiTitle") or title
            continue
        if t == "cost-state":
            reported = {"total_usd": e.get("totalCostUSD"), "by_model": {
                m: round(v.get("costUSD", 0), 6) for m, v in (e.get("modelUsage") or {}).items()}}
            continue
        ts = e.get("timestamp")
        text = prompt_text(e)
        if text is not None:
            close(cur)
            cur = {"prompt": text, "sent_at": ts, "ended_at": ts, "first_response_at": None,
                   "texts": [], "tools": {},
                   "usage": {}, "requests": 0, "entrypoint": e.get("entrypoint"),
                   "branch": e.get("gitBranch")}
            continue
        if cur is None:
            continue
        if ts and t in ("assistant", "user"):
            cur["ended_at"] = ts
        if t == "assistant":
            cur["first_response_at"] = cur["first_response_at"] or ts
            msg = e.get("message", {})
            for c in msg.get("content", []):
                if c.get("type") == "text" and c.get("text", "").strip():
                    cur["texts"].append(c["text"].strip())
                elif c.get("type") == "tool_use":
                    name = c.get("name", "?")
                    cur["tools"][name] = cur["tools"].get(name, 0) + 1
            mid = msg.get("id") or e.get("requestId")
            if mid and msg.get("usage"):
                seen_msgs[mid] = (cur, msg.get("model"), msg["usage"])
    close(cur)

    for turn, model, u in seen_msgs.values():
        acc = turn["usage"].setdefault(model, empty_usage())
        add_usage(acc, u)
        turn["requests"] += 1

    # Attribute subagent usage to the turn it happened in, by timestamp.
    sub_seen = {}
    for e in sub_entries:
        if e.get("type") == "assistant" and e.get("message", {}).get("usage") and e.get("timestamp"):
            mid = e["message"].get("id") or e.get("requestId")
            sub_seen[mid] = e
    for e in sub_seen.values():
        ets = parse_ts(e["timestamp"])
        for turn in reversed(turns):
            if parse_ts(turn["sent_at"]) <= ets:
                acc = turn["usage"].setdefault(e["message"].get("model"), empty_usage())
                add_usage(acc, e["message"]["usage"])
                turn["requests"] += 1
                break

    snaps = plan_snapshots(entries)
    previous_snaps = []
    prev_file = OUT_DIR / f"{session_id}.json"
    if prev_file.exists():
        try:
            previous_snaps = json.loads(prev_file.read_text()).get("plan_usage_snapshots") or []
        except Exception:
            previous_snaps = []
    merged = {sn["at"]: sn for sn in previous_snaps}
    merged.update({sn["at"]: sn for sn in snaps})
    snaps = sorted(merged.values(), key=lambda x: x["at"])

    # Plan usage per turn. A rate_limit_event is emitted whenever this session sees the
    # utilization change, so the latest snapshot at time t is the value as of t. Usage from
    # concurrent work while the session sat idle surfaces in the first reading(s) of the next
    # turn, so the baseline is taken a little after the turn's first model response, and the
    # end value at the turn's last activity. Idle gaps are never attributed to a turn.
    def value_at(window, t):
        best = None
        for sn in snaps:
            if parse_ts(sn["at"]) > t:
                break
            if sn.get(window) is not None:
                best = sn
        return None if best is None else {
            "value": best[window], "resets_at": best.get(window + "_resets_at"), "at": best["at"]}

    def plan_usage(turn):
        first = parse_ts(turn["first_response_at"] or turn["sent_at"])
        start_t = first + timedelta(seconds=BASELINE_GRACE_S)
        end_t = parse_ts(turn["ended_at"]) + timedelta(seconds=5)
        out = {}
        for w in ("five_hour", "seven_day"):
            a, b = value_at(w, start_t), value_at(w, end_t)
            d = None
            if a and b and a["resets_at"] == b["resets_at"]:
                d = round(b["value"] - a["value"], 4)
            out[w] = {"start": a and a["value"], "end": b and b["value"], "delta": d}
        return out

    out_turns = []
    for i, turn in enumerate(turns):
        start = parse_ts(turn["sent_at"])
        end = parse_ts(turn["ended_at"])
        nxt = parse_ts(turns[i + 1]["sent_at"]) if i + 1 < len(turns) else None
        turn_commits = [
            {"sha": c["sha"], "subject": c["subject"], "time": c["time"].isoformat()}
            for c in commits if c["time"] >= start and (nxt is None or c["time"] < nxt)
        ]
        turn_commits.sort(key=lambda c: c["time"])
        usage = {}
        total_cost = 0.0
        cost_known = True
        for model, u in turn["usage"].items():
            c = cost(model, u)
            usage[model] = dict(u, cost_usd=None if c is None else round(c, 6))
            if c is None:
                cost_known = False
            else:
                total_cost += c
        out_turns.append({
            "index": i + 1,
            "sent_at": turn["sent_at"],
            "ended_at": turn["ended_at"],
            "duration_s": round((end - start).total_seconds()),
            "prompt": turn["prompt"],
            "reply": turn["texts"][-1] if turn["texts"] else "",
            "progress_notes": turn["texts"][:-1],
            "tools": dict(sorted(turn["tools"].items(), key=lambda kv: -kv[1])),
            "api_requests": turn["requests"],
            "usage": usage,
            "cost_usd": round(total_cost, 6) if cost_known else None,
            "commits": turn_commits,
            "entrypoint": turn["entrypoint"],
            "branch": turn["branch"],
            # Utilization (0..1, 1% resolution) of the plan's 5-hour and weekly limits at the
            # start and end of this turn. Account-wide: concurrent work during the turn is
            # included; the making-of page filters implausible jumps against the turn's cost.
            "plan_usage": plan_usage(turn),
        })

    if not out_turns:
        return None

    remote_id = os.environ.get("CLAUDE_CODE_REMOTE_SESSION_ID", "")
    session_url = None
    if remote_id.startswith("cse_") and os.environ.get("CLAUDE_CODE_SESSION_ID") == session_id:
        session_url = "https://claude.ai/code/session_" + remote_id[len("cse_"):]

    out_file = OUT_DIR / f"{session_id}.json"
    previous = {}
    if out_file.exists():
        try:
            previous = json.loads(out_file.read_text())
        except Exception:
            previous = {}

    data = {
        "session_id": session_id,
        "title": title or previous.get("title"),
        "session_url": session_url or previous.get("session_url"),
        "claude_code_version": next((e.get("version") for e in entries if e.get("version")), None),
        "started_at": out_turns[0]["sent_at"],
        "ended_at": out_turns[-1]["ended_at"],
        "turns": out_turns,
        "plan_usage_snapshots": snaps,
        "totals": {
            "prompts": len(out_turns),
            "cost_usd": round(sum(t["cost_usd"] or 0 for t in out_turns), 6),
            "output_tokens": sum(u["output"] for t in out_turns for u in t["usage"].values()),
            "input_tokens": sum(u["input"] + u["cache_write_5m"] + u["cache_write_1h"] + u["cache_read"]
                                for t in out_turns for u in t["usage"].values()),
        },
        # Claude Code's own running cost tally (includes small background calls such as
        # title generation that don't appear in the transcript). Snapshot, may lag.
        "reported_by_claude_code": reported or previous.get("reported_by_claude_code"),
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    return out_file


def write_manifest():
    files = []
    for p in sorted(OUT_DIR.glob("*.json")):
        if p.name == "index.json":
            continue
        try:
            d = json.loads(p.read_text())
        except Exception:
            continue
        files.append((d.get("started_at") or "", p.name))
    files.sort()
    (OUT_DIR / "index.json").write_text(json.dumps({"sessions": [f for _, f in files]}, indent=1) + "\n")


def main():
    commits = git_commits()
    src = transcripts_dir()
    written = []
    if src.is_dir():
        for path in sorted(src.glob("*.jsonl")):
            out = export_session(path, commits)
            if out:
                written.append(out)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_manifest()
    if "--hook" not in sys.argv:
        for w in written:
            print(f"exported {w.relative_to(ROOT)}")


if __name__ == "__main__":
    if "--hook" in sys.argv:
        try:
            main()
        except Exception as exc:  # never block the session on logging
            print(f"ai_log: {exc}", file=sys.stderr)
        sys.exit(0)
    main()
