const SOURCE_URL = 'https://raw.githubusercontent.com/getto-dev/check/main/src/lib/catalog.ts';

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Failed to fetch source catalog: ${response.status}`);
  const source = await response.text();

  const match = source.match(/export const CATEGORIES = (\[[\s\S]*?\]) as const;\s*\n\s*export const CATALOG:Record<string,Service\[]>=(\{[\s\S]*?\});/);
  if (!match) throw new Error('Could not parse CATEGORIES/CATALOG from source catalog.ts');

  const categories = Function(`"use strict"; return (${match[1]});`)();
  const catalog = Function(`"use strict"; return (${match[2]});`)();

  const items = Object.entries(catalog).flatMap(([categoryId, categoryItems]) =>
    categoryItems.map((item) => ({
      id: item.id,
      name: item.n,
      description: item.d,
      unit: item.u,
      priceKopecks: Math.round(Number(item.p) * 100),
      categoryId,
      type: 'service',
    })),
  );

  const ids = new Set();
  for (const item of items) {
    if (!item.id || ids.has(item.id)) throw new Error(`Duplicate/empty item id: ${item.id}`);
    ids.add(item.id);
    if (!item.name || !item.unit || !Number.isInteger(item.priceKopecks) || item.priceKopecks < 0) {
      throw new Error(`Invalid item: ${item.id}`);
    }
  }

  const categoryIds = new Set(categories.map((category) => category.id));
  for (const item of items) {
    if (!categoryIds.has(item.categoryId)) {
      throw new Error(`Unknown category ${item.categoryId} for ${item.id}`);
    }
  }

  const dataset = {
    schemaVersion: 1,
    id: 'plumbing',
    name: 'Сантехника',
    version: '1.0.0',
    locale: 'ru-RU',
    currency: 'RUB',
    categories: categories.map(({ id, name }) => ({ id, name })),
    items,
    synonyms: { schemaVersion: 1, groups: [] },
    config: {
      schemaVersion: 1,
      profileId: 'plumbing',
      name: 'Сантехника',
      locale: 'ru-RU',
      currency: 'RUB',
      features: { services: true, materials: true, laborRates: true },
    },
  };

  const fs = await import('node:fs/promises');
  await fs.mkdir('plumbing', { recursive: true });
  await fs.writeFile('plumbing/catalog.json', JSON.stringify({ schemaVersion: 1, items }, null, 2) + '\n');
  await fs.writeFile('plumbing/categories.json', JSON.stringify({ schemaVersion: 1, categories: dataset.categories }, null, 2) + '\n');
  await fs.writeFile('plumbing/search-synonyms.json', JSON.stringify(dataset.synonyms, null, 2) + '\n');
  await fs.writeFile('plumbing/config.json', JSON.stringify(dataset.config, null, 2) + '\n');

  const manifest = {
    schemaVersion: 1,
    id: 'plumbing',
    name: 'Сантехника',
    version: dataset.version,
    locale: 'ru-RU',
    currency: 'RUB',
    files: {
      catalog: 'catalog.json',
      categories: 'categories.json',
      synonyms: 'search-synonyms.json',
      config: 'config.json',
    },
    itemCount: items.length,
  };
  await fs.writeFile('plumbing/manifest.json', JSON.stringify(manifest, null, 2) + '\n');

  const index = {
    schemaVersion: 1,
    profiles: [{ id: 'plumbing', name: 'Сантехника', version: dataset.version, manifest: 'plumbing/manifest.json', itemCount: items.length }],
  };
  await fs.writeFile('index.json', JSON.stringify(index, null, 2) + '\n');

  console.log(`Synced plumbing dataset: ${items.length} items, ${categories.length} categories.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
