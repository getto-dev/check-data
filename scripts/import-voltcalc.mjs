import fs from 'node:fs/promises';
import vm from 'node:vm';

const url = 'https://raw.githubusercontent.com/getto-dev/voltcalc/main/src/lib/catalog.ts';
const response = await fetch(url);
if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
const source = await response.text();
const javascript = source
  .replace(/interface Service \{[\s\S]*?\}\s*/, '')
  .replace('export const CATEGORIES', 'const CATEGORIES')
  .replace('export const CATALOG', 'const CATALOG')
  .concat('\nresult = { CATEGORIES, CATALOG };');
const context = {};
vm.createContext(context);
vm.runInContext(javascript, context, { timeout: 1000 });
const { CATEGORIES, CATALOG } = context.result;
const items = CATEGORIES.flatMap(({ id: categoryId }) => (CATALOG[categoryId] ?? []).map((item) => ({
  id: item.id,
  name: item.n,
  description: item.d,
  unit: item.u,
  priceKopecks: Math.round(item.p * 100),
  categoryId,
  type: 'service',
})));
const manifestPath = 'electrical/manifest.json';
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
manifest.name = 'Электрика';
manifest.version = '1.0.0';
manifest.itemCount = items.length;
await fs.writeFile('electrical/catalog.json', `${JSON.stringify({ schemaVersion: 1, items }, null, 2)}\n`);
await fs.writeFile('electrical/categories.json', `${JSON.stringify({ schemaVersion: 1, categories: CATEGORIES.map(({ id, name }) => ({ id, name })) }, null, 2)}\n`);
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Imported ${items.length} electrical price items from voltcalc.`);
