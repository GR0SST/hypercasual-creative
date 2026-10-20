// Scaffold a new creative from the template.
//   bun <skill>/scripts/new-project.mjs <dir>
import { cpSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const dest = resolve(process.argv[2] ?? '');
if (!process.argv[2]) {
  console.error('usage: bun new-project.mjs <dir>');
  process.exit(1);
}
if (existsSync(dest) && readdirSync(dest).length) {
  console.error(`${dest} exists and is not empty`);
  process.exit(1);
}
const src = join(dirname(new URL(import.meta.url).pathname), '..', 'template');
const skip = new Set(['node_modules', 'renders', 'review', '.hyperframes', 'events.json', 'bun.lock']);
cpSync(src, dest, { recursive: true, filter: (p) => !skip.has(p.split('/').pop()) });
const run = (cmd, args) => execFileSync(cmd, args, { cwd: dest, stdio: 'inherit' });
run('bun', ['install']);
run('bun', ['src/sim/bake.mjs']);
run('bun', ['scripts/sfx-sync.mjs']);
console.log(`\ncreated ${dest}\n  bunx hyperframes snapshot --at 1,5.4,9.5,12.5 --no-end   # stills\n  bunx hyperframes preview                                  # Studio\n  bunx hyperframes render -o renders/demo.mp4               # video`);
