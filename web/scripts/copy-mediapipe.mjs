// Copies MediaPipe's WebAssembly runtime from node_modules into public/, so the form page loads it
// from this machine instead of a CDN. Runs before `npm run dev` and `npm run build`.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const target = join(root, 'public', 'mediapipe', 'wasm');

if (!existsSync(source)) {
  console.error('MediaPipe is not installed. Run "npm install" in web/ first.');
  process.exit(1);
}
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`MediaPipe wasm ready in ${target}`);
