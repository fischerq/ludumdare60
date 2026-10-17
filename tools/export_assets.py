#!/usr/bin/env python3
"""Export every texture BootScene draws in code to assets/<key>.png (1x, transparent).

Runs tools/export-assets.html in headless Chromium, so the PNGs come from the game's own drawing code.
Run it after any change to the code-drawn art:  python3 tools/export_assets.py [--chrome PATH]
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--chrome')
    chrome = find_chrome(ap.parse_args().chrome)

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
    for key, data in textures.items():
        (OUT / f'{key}.png').write_bytes(base64.b64decode(data.split(',', 1)[1]))
    print(f'{len(textures)} textures -> {OUT.relative_to(ROOT)}/')


if __name__ == '__main__':
    main()
