// Scaffold a new creative from the template.
//   bun <skill>/scripts/new-project.mjs <dir>
import { cpSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
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
// Generated/local stuff at the template ROOT only (scripts/review must be copied).
const skip = new Set(['node_modules', 'renders', 'review', '.hyperframes', 'events.json', 'bun.lock']);
cpSync(src, dest, { recursive: true, filter: (p) => !skip.has(relative(src, p).split(sep)[0]) });
const run = (cmd, args) => execFileSync(cmd, args, { cwd: dest, stdio: 'inherit' });
run('bun', ['install']);
run('bun', ['src/sim/bake.mjs']);
console.log(`\ncreated ${dest}\n  bun run shot 1,5.4,9.5,12.5            # stills -> renders/shots/sheet.jpg\n  bun run render -o renders/demo.mp4     # video + sound\n  bun run review renders/demo.mp4        # frame review`);
