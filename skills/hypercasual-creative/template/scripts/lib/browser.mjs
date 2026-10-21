// Shared by shot/render: serve the project, open pages in headless Chrome
// (hardware GPU: Metal on macOS, D3D11 on Windows), wait until the creative says it's ready.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { findChrome, gpuArgs } from './platform.mjs';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

export function serve(dir = process.cwd(), port = 0) {
  const root = resolve(dir);
  const server = Bun.serve({
    port,
    fetch(req) {
      const path = decodeURIComponent(new URL(req.url).pathname);
      const file = join(root, path === '/' ? 'index.html' : path);
      if ((file !== root && !file.startsWith(root + sep)) || !existsSync(file)) return new Response('not found', { status: 404 });
      return new Response(Bun.file(file), { headers: { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' } });
    },
  });
  return { url: `http://localhost:${server.port}/`, stop: () => server.stop(true) };
}

export async function launch() {
  return puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: [...gpuArgs(), '--autoplay-policy=no-user-gesture-required'],
  });
}

export async function openCreative(browser, url) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('[console]', m.text()));
  await page.goto(`${url}?capture`, { waitUntil: 'load' });
  await page.waitForFunction('window.__creative?.ready === true', { timeout: 120000 });
  const cdp = await page.createCDPSession();
  // Render a frame at video time t and grab it (JPEG keeps capture fast).
  const frame = async (t, format = 'jpeg') => {
    await page.evaluate((tt) => window.__creative.renderAt(tt), t);
    const { data } = await cdp.send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? 95 : undefined, clip: { x: 0, y: 0, width: 1080, height: 1920, scale: 1 }, optimizeForSpeed: true });
    return Buffer.from(data, 'base64');
  };
  const info = await page.evaluate(() => ({ duration: window.__creative.duration, fps: window.__creative.fps }));
  return { page, frame, ...info };
}

// browser.close() can hang after many pages; give it 3 s, then kill Chrome.
export async function shutdown(browser, srv) {
  const proc = browser.process();
  await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
  if (proc && proc.exitCode === null) proc.kill('SIGKILL');
  srv?.stop();
}
