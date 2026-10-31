// Local preview of the built site with Cloudflare's rules (see wrangler.jsonc): /slug serves slug.html,
// a real file is served as is, and any other path falls back to index.html (the app routes it).
// Usage: node scripts/serve.mjs [port]   (after `npm run build`)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'web', 'browser');
const PORT = Number(process.argv[2]) || 8765;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary',
};

const isFile = (p) => stat(p).then((s) => s.isFile(), () => false);

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, path);
  let target = join(ROOT, 'index.html');
  if (path !== '/' && (await isFile(file))) target = file;
  else if (path !== '/' && (await isFile(file + '.html'))) target = file + '.html';
  try {
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(500).end();
  }
}).listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT}`));
