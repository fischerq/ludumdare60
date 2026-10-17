#!/usr/bin/env python3
"""Export every texture BootScene draws in code to assets/<key>.png (1x, transparent).

Runs tools/export-assets.html in headless Chromium, so the PNGs come from the game's own drawing code.
Run it after any change to the code-drawn art:  python3 tools/export_assets.py [--chrome PATH]

--hook: for the Claude Code PostToolUse hook (.claude/settings.json). Exports only when an art source file
changed since the last export (stamp in .git/), so the export stays current after every edit, whatever tool made it.
"""
import argparse, base64, functools, html, http.server, json, re, shutil, subprocess, sys, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets'
CANDIDATES = ['/opt/pw-browsers/chromium', 'chromium', 'chromium-browser', 'google-chrome', 'chrome',
              r'C:\Program Files\Google\Chrome\Application\chrome.exe',
              r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe']


def find_chrome(given):
    for c in ([given] if given else CANDIDATES):
        p = shutil.which(c) or (c if Path(c).is_file() else None)
        if p:
            return p
    sys.exit('No Chrome/Chromium found; pass --chrome PATH')


# Files whose changes can change the code-drawn art.
ART_SOURCES = ['src/scenes/BootScene.js', 'src/systems/tiles.js', 'src/config.js']
STAMP = ROOT / '.git' / 'export-assets.stamp'


def art_changed():
    newest = max((ROOT / f).stat().st_mtime for f in ART_SOURCES if (ROOT / f).exists())
    return not STAMP.exists() or newest > STAMP.stat().st_mtime


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--chrome')
    ap.add_argument('--hook', action='store_true')
    args = ap.parse_args()
    if args.hook:
        sys.stdin.read()  # the hook payload; not needed, the stamp decides
        if not art_changed():
            return
    chrome = find_chrome(args.chrome)

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    handler = functools.partial(Quiet, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_address[1]}/tools/export-assets.html'
    try:
        dom = subprocess.run([chrome, '--headless', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=10000',
                              '--dump-dom', url], capture_output=True, text=True, timeout=120).stdout
    finally:
        server.shutdown()

    m = re.search(r'<pre id="out" hidden="">(.*?)</pre>', dom, re.S)
    if not m or not m.group(1).strip():
        sys.exit('Export page produced no textures (is the Phaser CDN reachable?)')
    textures = json.loads(html.unescape(m.group(1)))
    OUT.mkdir(exist_ok=True)
    # Drop exports of textures that no longer exist (Max's folder and other files are left alone).
    # Keys with a slash are tiles: '<tileset>/<tile>' goes to assets/<tileset>/<tile>.png.
    for old in OUT.rglob('*.png'):
        rel = old.relative_to(OUT)
        if rel.parts[0] != 'from-max' and rel.with_suffix('').as_posix() not in textures:
            old.unlink()
    for key, data in textures.items():
        dest = OUT / f'{key}.png'
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(base64.b64decode(data.split(',', 1)[1]))
    if STAMP.parent.is_dir():
        STAMP.touch()
    print(f'{len(textures)} textures -> {OUT.relative_to(ROOT)}/' + (' (art changed: commit the PNGs with it)' if args.hook else ''))


if __name__ == '__main__':
    main()
