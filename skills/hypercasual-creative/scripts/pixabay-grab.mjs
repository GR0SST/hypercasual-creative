// Grab preview MP3s from a Pixabay search page through a real (headed) Chrome
// (Pixabay's CDN 403s plain curl).
//   bun pixabay-grab.mjs "<search url>" [maxTracks=8] [outDir]
// Prints JSON {title, href, dur, audio, file}; with outDir, downloads each MP3
// through the browser session as <outDir>/<slug>.mp3.
// Needs puppeteer-core (bun add -d puppeteer-core) and Google Chrome.
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [url, maxArg, outDir] = process.argv.slice(2);
if (!url) {
  console.error('usage: bun pixabay-grab.mjs "<pixabay search url>" [max=8] [outDir]');
  process.exit(1);
}
const max = parseInt(maxArg ?? '8', 10);
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: ['--window-size=1300,900', '--disable-blink-features=AutomationControlled', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1300, height: 900 });
let lastAudio = null;
page.on('request', (r) => {
  const u = r.url();
  if (u.includes('cdn.pixabay.com') && /\.(mp3|m4a|ogg)(\?|$)/.test(u)) lastAudio = u;
});
await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 3000));

const buttons = await page.$$('button[aria-label*="Play" i], button[class*="play" i]');
const out = [];
for (const b of buttons.slice(0, max)) {
  lastAudio = null;
  try {
    await b.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await b.click();
  } catch {
    continue;
  }
  for (let i = 0; i < 30 && !lastAudio; i++) await new Promise((r) => setTimeout(r, 200));
  const info = await b.evaluate((el) => {
    let n = el;
    for (let i = 0; i < 8 && n; i++) {
      n = n.parentElement;
      const a = n?.querySelector('a[href*="/music/"], a[href*="/sound-effects/"]');
      if (a && a.textContent.trim().length > 2) {
        const dur = n.textContent.match(/\b\d{1,2}:\d{2}\b/);
        return { title: a.textContent.trim(), href: a.href, dur: dur?.[0] };
      }
    }
    return {};
  });
  const item = { ...info, audio: lastAudio };
  if (outDir && lastAudio) {
    mkdirSync(outDir, { recursive: true });
    const b64 = await page.evaluate(async (u) => {
      const buf = await (await fetch(u)).arrayBuffer();
      let s = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    }, lastAudio);
    const slug = (info.title ?? `track_${out.length}`).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
    item.file = join(outDir, `${slug || 'track'}_${out.length + 1}.mp3`);
    writeFileSync(item.file, Buffer.from(b64, 'base64'));
  }
  out.push(item);
  try {
    await b.click();
  } catch {}
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
