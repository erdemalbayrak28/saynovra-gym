// Renders a reel to MP4 (or to a few still frames) by driving headless Chrome over a local server.
//
//   node render.mjs                                   classic reel, 24 fps
//   node render.mjs cyber                             cyberpunk reel, 30 fps
//   node render.mjs cyber --stills=1,4.5,12 --out=dir PNG stills at those seconds, no video
//
// The renderers live in web/src/lib as TypeScript; the server strips the types and serves them
// as browser modules, so the video always comes from the same code the web studio runs.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const studioDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(studioDir, '..');
const libDir = path.join(workspaceRoot, 'web', 'src', 'lib');
const webPublic = path.join(workspaceRoot, 'web', 'public');
const outDir = path.join(studioDir, 'cikti');
const engineDir = path.join(studioDir, 'src', 'engine');
const fontsCss = fs.readFileSync(path.join(workspaceRoot, 'web', 'src', 'fonts.css'), 'utf8');

const WIDTH = 1080;
const HEIGHT = 1350; // Instagram 4:5
const IDLE_TIMEOUT_MS = 120_000;
const STATIC_TYPES = { '.woff2': 'font/woff2', '.png': 'image/png' };

/**
 * Each variant names its outputs and carries a browser-side adapter: a module snippet that
 * exports createRenderer() -> { totalSec, draw(ctx, t) }.
 */
const VARIANTS = {
  classic: {
    fps: 24,
    crf: 18,
    preset: 'fast',
    coverAt: 2.2,
    videos: [
      path.join(outDir, 'saynovra-instagram-video.mp4'),
      path.join(workspaceRoot, 'novra-gym-instagram-reel.mp4'),
      path.join(webPublic, 'novra-gym-instagram-reel.mp4'),
    ],
    covers: [path.join(outDir, 'saynovra-instagram-kapak.png'), path.join(webPublic, 'novra-gym-instagram-kapak.png')],
    engine: ['reelRenderer.ts', 'reelBackground.ts', 'saynovraLogo.ts'],
    adapter: `
      import { DEFAULT_REEL_CONFIG, renderReelFrame, getTotalDuration } from '/lib/reelRenderer';
      import { loadReelAssets } from '/lib/reelBackground';
      async function createRenderer() {
        await loadReelAssets();
        return {
          totalSec: getTotalDuration(DEFAULT_REEL_CONFIG),
          draw: (ctx, t) => renderReelFrame(ctx, JOB.width, JOB.height, t, DEFAULT_REEL_CONFIG),
        };
      }`,
  },
  cyber: {
    fps: 30,
    crf: 19,
    preset: 'medium',
    coverAt: 3.4,
    videos: [path.join(outDir, 'saynovra-instagram-video-cyberpunk.mp4')],
    covers: [path.join(outDir, 'saynovra-instagram-kapak-cyberpunk.png')],
    engine: ['cyber', 'saynovraLogo.ts'],
    adapter: `
      import { DEFAULT_CYBER_CONFIG, getCyberDuration } from '/lib/cyber/config';
      import { renderCyberFrame } from '/lib/cyber/cyberReel';
      async function createRenderer() {
        const options = { fps: JOB.fps, motionSamples: JOB.stills ? 2 : 3 };
        return {
          totalSec: getCyberDuration(DEFAULT_CYBER_CONFIG),
          draw: (ctx, t) => renderCyberFrame(ctx, JOB.width, JOB.height, t, DEFAULT_CYBER_CONFIG, options),
        };
      }`,
  },
};

function parseArgs(argv) {
  const variantName = argv.find((a) => !a.startsWith('--')) ?? 'classic';
  const variant = VARIANTS[variantName];
  if (!variant) throw new Error(`Unknown variant "${variantName}". Use one of: ${Object.keys(VARIANTS).join(', ')}`);
  const option = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const stillsArg = option('stills');
  const stills = stillsArg ? stillsArg.split(',').map(Number) : null;
  if (stills && stills.some((s) => !Number.isFinite(s) || s < 0)) throw new Error('--stills takes seconds, e.g. --stills=1,4.5,12');
  const stillsDir = path.resolve(option('out') ?? path.join(outDir, 'kareler'));
  return { variantName, variant, stills, stillsDir };
}

const { variantName, variant, stills, stillsDir } = parseArgs(process.argv.slice(2));
fs.mkdirSync(outDir, { recursive: true });
if (stills) fs.mkdirSync(stillsDir, { recursive: true });

// The studio folder keeps a readable copy of the engine it was rendered with.
fs.mkdirSync(engineDir, { recursive: true });
for (const entry of variant.engine) {
  fs.cpSync(path.join(libDir, entry), path.join(engineDir, entry), { recursive: true });
}

const job = { width: WIDTH, height: HEIGHT, fps: variant.fps, coverAt: variant.coverAt, stills };

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>${fontsCss}
  body { margin: 0; background: #020306; }</style>
</head>
<body>
  <canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas>
  <script>
    // A module that fails to load or throws while loading never reaches run(); report it here.
    const report = (what) => fetch('/error?msg=' + encodeURIComponent(what));
    window.addEventListener('error', (event) => {
      const source = event.target && event.target.src ? 'Could not load ' + event.target.src : event.message;
      report((source || 'A module failed to load') + (event.filename ? ' (' + event.filename + ':' + event.lineno + ')' : ''));
    }, true);
    window.addEventListener('unhandledrejection', (event) => report(String((event.reason && event.reason.stack) || event.reason)));
  </script>
  <script type="module">
    ${variant.adapter}
    const JOB = ${JSON.stringify(job)};
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const post = (url, body) => fetch(url, { method: 'POST', body });
    const snapshot = (type, quality) =>
      new Promise((resolve) => canvas.toBlob(resolve, type, quality)).then((blob) => blob.arrayBuffer());

    // Canvas text only uses a webfont once it is loaded; wait for every brand face first.
    async function waitForFonts() {
      const faces = [
        '700 76px "Space Grotesk"', '500 24px "Space Grotesk"',
        '400 24px Inter', '500 24px Inter', '600 24px Inter', '700 24px Inter',
        '400 20px "JetBrains Mono"', '500 20px "JetBrains Mono"', '600 20px "JetBrains Mono"', '700 20px "JetBrains Mono"',
      ];
      await Promise.all(faces.map((f) => document.fonts.load(f, 'AaĞğİıŞşÇçÖöÜüÂâ')));
      await document.fonts.ready;
      const missing = ['Space Grotesk', 'Inter', 'JetBrains Mono'].filter((f) => !document.fonts.check('16px "' + f + '"', 'Ğ'));
      if (missing.length) throw new Error('Fonts not loaded: ' + missing.join(', '));
    }

    async function run() {
      await waitForFonts();
      const renderer = await createRenderer();
      if (JOB.stills) {
        for (const t of JOB.stills) {
          renderer.draw(ctx, t);
          await post('/still?name=t' + t.toFixed(2), await snapshot('image/png'));
        }
        await post('/done');
        return;
      }
      renderer.draw(ctx, JOB.coverAt);
      await post('/cover', await snapshot('image/png'));
      const totalFrames = Math.round(renderer.totalSec * JOB.fps);
      for (let i = 0; i < totalFrames; i++) {
        renderer.draw(ctx, i / JOB.fps);
        await post('/frame?i=' + i + '&total=' + totalFrames, await snapshot('image/jpeg', 0.95));
      }
      await post('/done');
    }
    run().catch((err) => fetch('/error?msg=' + encodeURIComponent(String((err && err.stack) || err))));
  </script>
</body>
</html>`;

let ffmpeg = null;
if (!stills) {
  ffmpeg = spawn(
    'ffmpeg',
    [
      '-y',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-framerate', String(variant.fps),
      '-i', '-',
      // Frames arrive as full-range BT.601 JPEG; convert to what players expect from HD video.
      '-vf', 'scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv',
      '-c:v', 'libx264',
      '-preset', variant.preset,
      '-crf', String(variant.crf),
      '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709',
      '-color_primaries', 'bt709',
      '-color_trc', 'bt709',
      '-movflags', '+faststart',
      variant.videos[0],
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  );
  let ffmpegLog = '';
  ffmpeg.stderr.on('data', (chunk) => {
    ffmpegLog = (ffmpegLog + chunk).slice(-2000);
  });
  ffmpeg.on('error', (err) => fail(`ffmpeg could not start: ${err.message}`));
  ffmpeg.on('close', (code) => {
    if (code !== 0 && !finishing) fail(`ffmpeg exited with code ${code}\n${ffmpegLog}`);
  });
}

let chrome = null;
let profileDir = null;
let finishing = false;
let lastActivity = Date.now();

function cleanUp() {
  if (chrome) chrome.kill();
  if (!profileDir) return;
  try {
    fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // Chrome can still hold its profile for a moment after being killed. It is a throwaway
    // folder in the system temp directory, so leaving it behind is harmless.
  }
}

function fail(message) {
  console.error(message);
  if (ffmpeg) ffmpeg.kill();
  cleanUp();
  process.exit(1);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const moduleCache = new Map();

/** Serves web/src/lib/<name>[.ts] as a browser module with the types stripped. */
function serveModule(pathname, res) {
  const relative = pathname.slice('/lib/'.length);
  if (!/^[\w./-]+$/.test(relative) || relative.includes('..')) return notFound(res);
  // Same lookup a bundler does: the name as given, with .ts added, or a folder's index.ts.
  const base = path.join(libDir, relative);
  const file = [base, `${base}.ts`, path.join(base, 'index.ts')].find((candidate) => candidate.endsWith('.ts') && fs.existsSync(candidate));
  if (!file || !file.startsWith(libDir + path.sep)) {
    console.error(`Module not found: ${pathname}`);
    return notFound(res);
  }
  if (file === path.join(base, 'index.ts')) {
    // Send the browser to the index itself, so the folder's relative imports resolve inside it.
    res.writeHead(302, { Location: `${pathname.replace(/\/$/, '')}/index` });
    res.end();
    return;
  }
  if (!moduleCache.has(file)) moduleCache.set(file, stripTypeScriptTypes(fs.readFileSync(file, 'utf8')));
  res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
  res.end(moduleCache.get(file));
}

function serveStatic(pathname, res) {
  const file = path.normalize(path.join(webPublic, pathname));
  const type = STATIC_TYPES[path.extname(file)];
  if (!file.startsWith(webPublic + path.sep) || !type || !fs.existsSync(file)) return notFound(res);
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
}

function notFound(res) {
  res.writeHead(404);
  res.end();
}

function ok(res) {
  res.writeHead(200);
  res.end('ok');
}

async function finish(res) {
  ok(res);
  finishing = true;
  if (ffmpeg) {
    console.log(`All frames rendered, finalizing ${WIDTH}x${HEIGHT} MP4...`);
    const closed = new Promise((resolve) => ffmpeg.on('close', resolve));
    ffmpeg.stdin.end();
    const code = await closed;
    if (code !== 0) fail(`ffmpeg exited with code ${code}`);
    for (const copy of variant.videos.slice(1)) fs.copyFileSync(variant.videos[0], copy);
    console.log(`Video: ${variant.videos[0]}`);
  } else {
    console.log(`Stills: ${stillsDir}`);
  }
  cleanUp();
  server.close(() => process.exit(0));
}

const server = http.createServer(async (req, res) => {
  lastActivity = Date.now();
  const url = new URL(req.url, 'http://127.0.0.1');
  const { pathname } = url;
  try {
    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else if (pathname.startsWith('/lib/')) {
      serveModule(pathname, res);
    } else if (pathname.startsWith('/fonts/') || pathname.startsWith('/reel/')) {
      serveStatic(pathname, res);
    } else if (pathname === '/cover' && req.method === 'POST') {
      const body = await readBody(req);
      for (const cover of variant.covers) fs.writeFileSync(cover, body);
      ok(res);
    } else if (pathname === '/still' && req.method === 'POST') {
      const name = url.searchParams.get('name') ?? '';
      if (!stills || !/^[\w.-]+$/.test(name)) return notFound(res);
      fs.writeFileSync(path.join(stillsDir, `${name}.png`), await readBody(req));
      ok(res);
    } else if (pathname === '/frame' && req.method === 'POST' && ffmpeg) {
      const body = await readBody(req);
      const index = Number(url.searchParams.get('i'));
      const total = Number(url.searchParams.get('total'));
      if (index % Math.max(1, Math.round(total / 10)) === 0) {
        console.log(`Rendered frame ${index}/${total} (${Math.round((index / total) * 100)}%)`);
      }
      // Hold the reply until ffmpeg has room, so the browser never outruns the encoder.
      if (!ffmpeg.stdin.write(body)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
      ok(res);
    } else if (pathname === '/done' && req.method === 'POST') {
      await finish(res);
    } else if (pathname === '/error') {
      ok(res);
      fail(`Browser error: ${url.searchParams.get('msg')}`);
    } else {
      notFound(res);
    }
  } catch (err) {
    if (!res.headersSent) res.writeHead(500);
    res.end();
    fail(`Render server error: ${err instanceof Error ? err.stack : err}`);
  }
});

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  const found = candidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH to chrome.exe.');
  return found;
}

server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  console.log(`Rendering "${variantName}" ${stills ? `stills at ${stills.join(', ')} s` : 'video'} (server on port ${port})`);
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saynovra-reel-'));
  chrome = spawn(
    findChrome(),
    ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profileDir}`, `http://127.0.0.1:${port}/`],
    { stdio: 'ignore' },
  );
  chrome.on('error', (err) => fail(`Chrome could not start: ${err.message}`));
});

// A page that stops talking (crashed tab, hung encode) must not leave the script running forever.
setInterval(() => {
  if (!finishing && Date.now() - lastActivity > IDLE_TIMEOUT_MS) fail('No activity from the browser for 2 minutes, giving up.');
}, 5000).unref();
