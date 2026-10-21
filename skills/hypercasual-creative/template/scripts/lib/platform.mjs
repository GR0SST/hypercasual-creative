// OS differences in one place (macOS, Windows, Linux).
import { existsSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

const OS = process.platform;

const onPath = (cmd) => {
  try {
    const out = execFileSync(OS === 'win32' ? 'where' : 'which', [cmd], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split(/\r?\n/)[0];
    return out || null;
  } catch {
    return null;
  }
};

// Chrome (or Chromium / Edge, both work with puppeteer). Override with CHROME=<path>.
export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const env = (k) => process.env[k] ?? '';
  const candidates =
    OS === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ]
      : OS === 'win32'
        ? [
            join(env('PROGRAMFILES'), 'Google/Chrome/Application/chrome.exe'),
            join(env('PROGRAMFILES(X86)'), 'Google/Chrome/Application/chrome.exe'),
            join(env('LOCALAPPDATA'), 'Google/Chrome/Application/chrome.exe'),
            join(env('PROGRAMFILES(X86)'), 'Microsoft/Edge/Application/msedge.exe'),
            join(env('PROGRAMFILES'), 'Microsoft/Edge/Application/msedge.exe'),
          ]
        : [];
  const hit = candidates.find((p) => p && existsSync(p)) ?? ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'].map(onPath).find(Boolean);
  if (!hit) throw new Error('Google Chrome not found. Install it, or set CHROME=<path to chrome executable>.');
  return hit;
}

// Hardware WebGL in headless Chrome: Metal on macOS, D3D11 on Windows, default GL on Linux.
export function gpuArgs() {
  const angle = OS === 'darwin' ? ['--use-angle=metal'] : OS === 'win32' ? ['--use-angle=d3d11'] : [];
  return [...angle, '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];
}

// Open a URL in the user's default browser.
export function openUrl(url) {
  const [cmd, args] = OS === 'darwin' ? ['open', [url]] : OS === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
}
