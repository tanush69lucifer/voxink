// Extracts the Phosphor "fill" icon set into a compact keyword -> svg body map,
// so the stage can show an icon for almost any noun with zero network calls.
import { readFileSync, writeFileSync } from 'node:fs';
const set = JSON.parse(readFileSync(new URL('../node_modules/@iconify-json/ph/icons.json', import.meta.url)));
const out = {};
for (const [name, ic] of Object.entries(set.icons)) {
  if (!name.endsWith('-fill')) continue;
  out[name.slice(0, -5)] = ic.body;
}
for (const [alias, a] of Object.entries(set.aliases || {})) {
  if (alias.endsWith('-fill') && out[a.parent?.slice(0, -5)]) out[alias.slice(0, -5)] = out[a.parent.slice(0, -5)];
}
writeFileSync(new URL('../src/engine/icon-data.json', import.meta.url), JSON.stringify(out));
console.log(Object.keys(out).length, 'icons');
