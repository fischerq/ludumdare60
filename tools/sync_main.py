#!/usr/bin/env python3
"""Keep the working branch merged with origin/main so PRs never sit in conflict.

  python3 tools/sync_main.py           # fetch origin/main and merge it into the current branch
  python3 tools/sync_main.py --hook    # UserPromptSubmit hook: same, never blocks; aborts on real conflicts
  python3 tools/sync_main.py --push    # PreToolUse(Bash) hook: runs only before `git push`; blocks the push
                                       # (exit 2) and leaves the conflict to resolve if one remains
  python3 tools/sync_main.py --ci      # GitHub Action (.github/workflows/sync-prs.yml): merge, exit 1 on a real
                                       # conflict (merge aborted); the workflow pushes

After a clean merge, --hook also pushes it when the branch has an upstream, so the open PR is out of conflict on
GitHub right away instead of only after the next push of the turn. Between sessions, the sync-prs workflow does
the same for every open PR whenever main changes.

Generated files (repo-stats.json, the sessions index) are never resolved by hand: they are regenerated with
tools/ai_log.py after the merge. Any other conflict is reported; with --push it stays in the tree so Claude
resolves it (keep both sides of decision logs) and pushes again.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "main"
GENERATED = ["making-of/repo-stats.json", "making-of/sessions/index.json"]


def git(*args, check=False):
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=60)
    if check and r.returncode:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r


def merging():
    return git("rev-parse", "-q", "--verify", "MERGE_HEAD").returncode == 0


def regenerate():
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(ROOT / "tools"))
    import ai_log
    ai_log.write_manifest()
    ai_log.write_repo_stats()
    git("add", *GENERATED)


def sync(keep_conflicts):
    """Returns None when in sync, or a message describing what Claude must do."""
    branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    if branch in ("HEAD", BASE) or merging():
        return None
    if git("fetch", "-q", "origin", BASE).returncode:
        return None  # offline: nothing to do
    if git("merge-base", "--is-ancestor", f"origin/{BASE}", "HEAD").returncode == 0:
        return None
    # Generated files are rewritten by every hook run; drop local copies so they can't block the merge.
    git("checkout", "--", *GENERATED)
    r = git("merge", "--no-ff", "--no-commit", f"origin/{BASE}")
    if not merging():
        if r.returncode:
            return f"Could not merge origin/{BASE} automatically: {(r.stderr or r.stdout).strip()}"
        return None
    conflicted = git("diff", "--name-only", "--diff-filter=U").stdout.split()
    for path in conflicted:
        if path in GENERATED:
            git("checkout", "--ours", "--", path)
    regenerate()
    others = [p for p in conflicted if p not in GENERATED]
    if others:
        if not keep_conflicts:
            git("merge", "--abort")
            return (f"origin/{BASE} conflicts with this branch in: {', '.join(others)}. Merge origin/{BASE} "
                    f"and resolve it (keep both sides of decision logs) before the next push.")
        return (f"Merged origin/{BASE}; resolve the conflicts in {', '.join(others)} (keep both sides of "
                f"decision logs), `git add` them, `git commit --no-edit`, then push again. Generated files "
                f"are already regenerated.")
    git("commit", "--no-edit", "-q", "-m", f"Merge origin/{BASE} into {branch}\n\n"
        "Automatic sync by tools/sync_main.py; generated making-of files regenerated.", check=True)
    print(f"sync_main: merged origin/{BASE} into {branch}")
    return None


def push_merge():
    """Pushes the branch if it tracks a remote branch (i.e. already has a PR); never blocks on failure."""
    if git("rev-parse", "-q", "--verify", "@{u}").returncode or merging():
        return
    if git("rev-list", "--count", "@{u}..HEAD").stdout.strip() == "0":
        return
    # The remote branch is already part of main: its PR was merged, so a push would add commits no open PR covers.
    if git("merge-base", "--is-ancestor", "@{u}", f"origin/{BASE}").returncode == 0:
        print("sync_main: not pushing, this branch's PR is already merged; restart the branch from main")
        return
    branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    r = git("push", "-q", "origin", branch)
    print(f"sync_main: pushed {branch}" if r.returncode == 0 else f"sync_main: push failed: {r.stderr.strip()}")


def main():
    if "--push" in sys.argv:
        try:
            cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")
        except Exception:
            cmd = ""
        if "git push" not in cmd:
            return 0
        msg = sync(keep_conflicts=True)
        if msg:
            print(f"Push blocked: {msg}", file=sys.stderr)
            return 2
        return 0
    msg = sync(keep_conflicts=False)
    if msg:
        print(f"sync_main: {msg}")
        return 1 if "--ci" in sys.argv else 0
    if "--hook" in sys.argv:
        push_merge()
    return 0


if __name__ == "__main__":
    if "--hook" in sys.argv or "--push" in sys.argv:
        try:
            sys.exit(main())
        except Exception as exc:  # never wedge the session on syncing
            print(f"sync_main: {exc}", file=sys.stderr)
            sys.exit(0)
    sys.exit(main())
