// Builds dist-demo/index.html: the whole app as one static page (no server needed).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..'), tmp = path.join(root, '.demo-tmp');
fs.rmSync(tmp, { recursive: true, force: true });
fs.cpSync(path.join(root, 'client/src'), path.join(tmp, 'src'), { recursive: true });
for (const f of ['api.js', 'useLiveState.js']) fs.cpSync(path.join(root, 'demo', f), path.join(tmp, 'src', f));
const { outputFiles } = await build({ entryPoints: [path.join(tmp, 'src/main.jsx')], bundle: true, minify: true, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.PROD': 'false' }, write: false, outdir: path.join(tmp, 'out') });
const get = ext => outputFiles.find(f => f.path.endsWith(ext)).text;
const css = get('.css').replace(/(prefers-color-scheme:\s*dark\)\s*\{):root\{/, '$1:root:not([data-theme="light"]){')
  + ':root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}';
const html = `<!DOCTYPE html><html lang="en-ZA"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>TaxSafe · What’s safe to spend</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet">
<style>${css}</style></head><body><div id="root"></div><script>${get('.js').replace(/<\/script/g, '<\\/script')}</script></body></html>`;
fs.mkdirSync(path.join(root, 'dist-demo'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist-demo/index.html'), html);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('dist-demo/index.html', html.length, 'bytes');
