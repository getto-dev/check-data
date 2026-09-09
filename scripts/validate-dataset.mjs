import { readFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const fail = (message) => {
  throw new Error(message);
};

const assertString = (value, label) => {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${label} must be a non-empty string`);
};

const assertPositiveInteger = (value, label) => {
  if (!Number.isInteger(value) || value < 1) fail(`${label} must be a positive integer`);
};

const main = async () => {
  const index = await readJson('index.json');
  if (index.schemaVersion !== 1 || !Array.isArray(index.profiles)) {
    fail('Invalid index.json');
  }

  const profileIds = new Set();
  for (const profile of index.profiles) {
    assertString(profile.id, 'index profile id');
    assertString(profile.name, `profile ${profile.id} name`);
    assertString(profile.version, `profile ${profile.id} version`);
    assertString(profile.manifest, `profile ${profile.id} manifest`);
    assertPositiveInteger(profile.itemCount, `profile ${profile.id} itemCount`);

    if (profileIds.has(profile.id)) fail(`Duplicate profile id: ${profile.id}`);
    profileIds.add(profile.id);

    const manifest = await readJson(profile.manifest);
    if (manifest.schemaVersion !== 1) fail(`${profile.id}: unsupported manifest schema`);
    if (manifest.id !== profile.id) fail(`${profile.id}: manifest id mismatch`);
    if (manifest.name !== profile.name) fail(`${profile.id}: manifest name mismatch`);
    if (manifest.version !== profile.version) fail(`${profile.id}: manifest version mismatch`);
    if (manifest.itemCount !== profile.itemCount) fail(`${profile.id}: manifest/index itemCount mismatch`);
    assertString(manifest.locale, `${profile.id} locale`);
    assertString(manifest.currency, `${profile.id} currency`);
    assertString(manifest.files?.catalog, `${profile.id} catalog file`);
    assertString(manifest.files?.categories, `${profile.id} categories file`);

    const base = profile.manifest.replace(/[^/]+$/, '');
    const catalog = await readJson(`${base}${manifest.files.catalog}`);
    const categoriesFile = await readJson(`${base}${manifest.files.categories}`);
    const synonyms = manifest.files.synonyms ? await readJson(`${base}${manifest.files.synonyms}`) : undefined;
    const config = manifest.files.config ? await readJson(`${base}${manifest.files.config}`) : undefined;

    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.items)) fail(`${profile.id}: invalid catalog`);
    if (categoriesFile.schemaVersion !== 1 || !Array.isArray(categoriesFile.categories)) fail(`${profile.id}: invalid categories`);
    if (catalog.items.length !== manifest.itemCount) {
      fail(`${profile.id}: catalog has ${catalog.items.length} items, manifest says ${manifest.itemCount}`);
    }

    const categoryIds = new Set();
    for (const category of categoriesFile.categories) {
      assertString(category.id, `${profile.id} category id`);
      assertString(category.name, `${profile.id} category ${category.id} name`);
      if (categoryIds.has(category.id)) fail(`${profile.id}: duplicate category id ${category.id}`);
      categoryIds.add(category.id);
    }

    const itemIds = new Set();
    for (const item of catalog.items) {
      assertString(item.id, `${profile.id} item id`);
      assertString(item.name, `${profile.id} item ${item.id} name`);
      assertString(item.unit, `${profile.id} item ${item.id} unit`);
      if (!Number.isInteger(item.priceKopecks) || item.priceKopecks < 0) {
        fail(`${profile.id} item ${item.id}: invalid priceKopecks`);
      }
      assertString(item.categoryId, `${profile.id} item ${item.id} categoryId`);
      if (!categoryIds.has(item.categoryId)) {
        fail(`${profile.id} item ${item.id}: unknown category ${item.categoryId}`);
      }
      if (item.type !== 'service' && item.type !== 'material') {
        fail(`${profile.id} item ${item.id}: invalid type`);
      }
      if (itemIds.has(item.id)) fail(`${profile.id}: duplicate item id ${item.id}`);
      itemIds.add(item.id);
    }

    if (synonyms !== undefined) {
      if (synonyms.schemaVersion !== 1 || !Array.isArray(synonyms.groups)) {
        fail(`${profile.id}: invalid search-synonyms.json`);
      }
      synonyms.groups.forEach((group, groupIndex) => {
        if (!Array.isArray(group) || group.length < 2) {
          fail(`${profile.id}: synonym group ${groupIndex} must contain at least two terms`);
        }
        group.forEach((term, termIndex) => assertString(term, `${profile.id} synonym ${groupIndex}.${termIndex}`));
      });
    }

    if (config !== undefined) {
      if (config.schemaVersion !== 1 || config.profileId !== profile.id) {
        fail(`${profile.id}: invalid config.json`);
      }
    }

    console.log(`Validated ${profile.id}: ${catalog.items.length} items, ${categoriesFile.categories.length} categories.`);
  }

  if (index.profiles.length === 0) fail('index.json contains no profiles');
  console.log(`Dataset validation passed: ${index.profiles.length} profile(s).`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
