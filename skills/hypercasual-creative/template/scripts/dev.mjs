// Live preview in the browser (real-time playback, loops):
//   bun run dev            -> http://localhost:5173/        ?t=5.4 holds a still
import { serve } from './lib/browser.mjs';
const srv = serve(process.cwd(), parseInt(process.argv[2] ?? '5173', 10));
console.log(`dev: ${srv.url}  (?t=<seconds> for a still)`);
