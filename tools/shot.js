// Screenshot a page of the game at phone size, for the making-of (see CLAUDE.md, "Screenshots").
// Dev tool only: uses the Playwright that comes preinstalled in the cloud container (global npm), the game
// itself stays build-free.
//
//   node tools/shot.js <session8>-<turn>-c<n> [page] [--scene Key [--data json]] [--wait ms] [--at rev | --root dir] [--full]
//   node tools/shot.js commit-<sha8>-before-<n> [page] --at <sha>^ ...   (before/after shots of an art commit)
//   node tools/shot.js commit-<sha8>-after-<n> [page] --at <sha> ...
//
// page: path under the site root, default '' (the game). --scene starts that Phaser scene first.
// --at shoots that git revision (from a temporary worktree); --root serves another checkout. Writes
// making-of/media/<name>.jpg in this checkout through publish_image in tools/ai_log.py.

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const repo = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args.splice(i, 2)[1]; };
const flag = (k) => { const i = args.indexOf(k); return i >= 0 && args.splice(i, 1).length > 0; };
const scene = opt('--scene'), data = JSON.parse(opt('--data', '{}')), wait = Number(opt('--wait', 2500)), at = opt('--at');
let root = path.resolve(opt('--root', repo));
const full = flag('--full');
const [name, page = ''] = args;
if (!name || !/^([0-9a-f]{8}-\d+-c\d+|commit-[0-9a-f]{8}-(before|after)-\d+)$/.test(name)) {
  console.error('usage: node tools/shot.js <session8>-<turn>-c<n> | commit-<sha8>-<before|after>-<n> [page] [--scene Key [--data json]] [--wait ms] [--at rev | --root dir] [--full]');
  process.exit(1);
}

const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
let worktree = null;
if (at) {
  worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-wt-'));
  execSync(`git worktree add -q --detach "${worktree}" "${at}"`, { cwd: repo });
  root = worktree;
}
const cleanup = () => { if (worktree) execSync(`git worktree remove --force "${worktree}"`, { cwd: repo }); };
const port = 8700 + Math.floor(Math.random() * 200);
const server = spawn('python3', ['-m', 'http.server', String(port)], { cwd: root, stdio: 'ignore' });

(async () => {
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errors = [];
  pg.on('pageerror', (e) => errors.push(String(e)));
  pg.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await pg.goto(`http://localhost:${port}/${page}`);
  await pg.waitForTimeout(scene ? 2500 : wait);
  if (scene) {
    await pg.evaluate(([k, d]) => {
      const g = window.game;
      g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key));
      g.scene.start(k, d);
    }, [scene, data]);
    await pg.waitForTimeout(wait);
  }
  const png = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shot-')), 'shot.png');
  await pg.screenshot({ path: png, fullPage: full });
  await browser.close();
  server.kill();
  cleanup();
  const dest = path.join(repo, 'making-of', 'media', `${name}.jpg`);
  execSync(`python3 -c "import sys,pathlib; sys.path.insert(0,'tools'); import ai_log; ` +
    `ai_log.publish_image(open(sys.argv[1],'rb').read(), pathlib.Path(sys.argv[2]))" "${png}" "${dest}"`, { cwd: repo });
  console.log(dest, errors.length ? `\nconsole errors:\n${errors.join('\n')}` : '(no console errors)');
})().catch((e) => { server.kill(); cleanup(); console.error(e); process.exit(1); });
