import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

await build({ entryPoints:['src/app.js'], bundle:true, minify:true, format:'iife', outfile:'app.bundle.js' });
let html=await readFile('index.html','utf8');
for(const asset of ['app.bundle.js','styles.css']){
  const hash=createHash('sha256').update(await readFile(asset)).digest('hex').slice(0,12);
  const escaped=asset.replaceAll('.','\\.');
  html=html.replace(new RegExp(`((?:src|href)="${escaped})(?:\\?v=[^"]*)?"`,'g'),`$1?v=${hash}"`);
}
await writeFile('index.html',html);
console.log('Generator gebaut; Browser-Dateien mit aktueller Versionskennung verknüpft.');
