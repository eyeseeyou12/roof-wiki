import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// Only a high-entropy password digest is committed. The password is delivered
// privately to the owner; it never enters the repository or deployment URL.
const PASSWORD_SHA256 = '2cb820420c391a9d5e62c0e9e12e85c3f4c2994e1236aedbc42b7275b0eadc7c';
const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.pdf':'application/pdf','.ico':'image/x-icon','.woff2':'font/woff2'};
const textExtensions = new Set(['.html','.js','.mjs','.css','.json','.svg','.txt','']);
const root = fileURLToPath(new URL('../../', import.meta.url));
export function protectSite(output) {
  const assets = {};
  function walk(dir) {
    for (const entry of readdirSync(dir,{withFileTypes:true})) {
      const path = join(dir,entry.name);
      if (entry.isDirectory()) {walk(path);continue;}
      if (entry.name.startsWith('_')) continue;
      const extension = extname(path).toLowerCase();
      const bytes = readFileSync(path);
      const binary = !textExtensions.has(extension);
      assets['/' + relative(output,path).replaceAll('\\','/')] = {body:bytes.toString(binary?'base64':'utf8'),base64:binary,type:types[extension] || 'application/octet-stream'};
    }
  }
  walk(output);
  const runtime = readFileSync(join(root,'scripts/lib/private-worker.mjs'),'utf8').replace('export function createPrivateWorker','function createPrivateWorker');
  const logging = readFileSync(join(root,'functions/api/log-search.js'),'utf8').replaceAll('export async function','async function');
  const worker = `${runtime}\n${logging}\nconst assets = ${JSON.stringify(assets)};\nexport default createPrivateWorker(assets, '${PASSWORD_SHA256}', {POST:onRequestPost, GET:onRequestGet});\n`;
  const sourceBytes = Buffer.byteLength(worker);
  const gzipBytes = gzipSync(worker).byteLength;
  // Fail the build before publishing if future assets exceed Workers' limit.
  // https://developers.cloudflare.com/workers/platform/limits/#worker-size
  if (sourceBytes >= 64 * 1024 * 1024) throw new Error('Private Worker exceeds the 64 MiB uncompressed bundle limit.');
  rmSync(output,{recursive:true,force:true});
  mkdirSync(output,{recursive:true});
  writeFileSync(join(output,'_worker.js'),worker);
  writeFileSync(join(output,'_routes.json'),JSON.stringify({version:1,include:['/*'],exclude:[]}));
  writeFileSync(join(output,'index.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Private Roof-Wiki</title><body><h1>Private Roof-Wiki</h1><p>The protected runtime is unavailable. The ventilation planner is not served from public storage.</p></body></html>');
  console.log(`Protected ${Object.keys(assets).length} assets in private Pages Worker (${(sourceBytes/1024/1024).toFixed(2)} MiB source; ${(gzipBytes/1024/1024).toFixed(2)} MiB gzip).`);
}
