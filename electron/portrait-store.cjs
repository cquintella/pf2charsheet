const fs = require('fs');
const path = require('path');

function slugifySegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'other';
}

function resolvePortraitDbDir(projectRoot) {
  const sibling = path.resolve(projectRoot, '../portraitdb');
  if (fs.existsSync(sibling)) return sibling;
  const publicPortraits = path.resolve(projectRoot, 'public/portraits');
  if (fs.existsSync(publicPortraits)) {
    return path.dirname(fs.realpathSync(publicPortraits));
  }
  return sibling;
}

function customIndexFile(portraitDbDir) {
  return path.join(portraitDbDir, 'custom-portraits.json');
}

function sortPortraits(entries) {
  return [...entries].sort((a, b) =>
    a.species.localeCompare(b.species, undefined, { sensitivity: 'base' })
    || a.sex.localeCompare(b.sex, undefined, { sensitivity: 'base' })
    || a.path.localeCompare(b.path, undefined, { sensitivity: 'base' })
  );
}

function listCustomPortraits(projectRoot) {
  const dir = resolvePortraitDbDir(projectRoot);
  const indexPath = customIndexFile(dir);
  if (!fs.existsSync(indexPath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    if (!Array.isArray(raw)) return [];
    return sortPortraits(
      raw.filter(
        (item) =>
          item &&
          typeof item.path === 'string' &&
          typeof item.species === 'string' &&
          typeof item.sex === 'string'
      )
    );
  } catch {
    return [];
  }
}

function addCustomPortrait(projectRoot, payload) {
  const species = typeof payload?.species === 'string' ? payload.species.trim() : '';
  const sex = typeof payload?.sex === 'string' ? payload.sex.trim() : '';
  const dataUrl = typeof payload?.dataUrl === 'string' ? payload.dataUrl.trim() : '';

  if (!species || !sex) {
    throw new Error('Species and gender are required');
  }

  const match = /^data:image\/(webp|png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid image data URL');
  }

  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  const portraitDbDir = resolvePortraitDbDir(projectRoot);
  const speciesSlug = slugifySegment(species);
  const sexSlug = slugifySegment(sex);
  const fileName = `${speciesSlug}-${sexSlug}-${Date.now().toString(36)}.${ext}`;

  const targetDir = path.join(portraitDbDir, 'portraits', speciesSlug, sexSlug);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, fileName), buffer);

  const entry = {
    path: `/portraits/${speciesSlug}/${sexSlug}/${fileName}`,
    species,
    sex,
    className: '',
  };

  const existing = listCustomPortraits(projectRoot).filter((item) => item.path !== entry.path);
  const organized = sortPortraits([...existing, entry]);
  fs.writeFileSync(customIndexFile(portraitDbDir), JSON.stringify(organized, null, 2));

  return entry;
}

function loadBuiltInFromPlugin(portraitDbDir) {
  const builtInPath = path.join(portraitDbDir, 'builtInPortraits.ts');
  if (!fs.existsSync(builtInPath)) return [];
  try {
    const src = fs.readFileSync(builtInPath, 'utf8');
    const results = [];
    const rangeRegex = /\{\s*species:\s*'([^']+)',\s*sex:\s*'([^']+)',\s*first:\s*(\d+),\s*last:\s*(\d+)\s*\}/g;
    let m;
    while ((m = rangeRegex.exec(src)) !== null) {
      const [, species, sex, firstStr, lastStr] = m;
      const first = Number(firstStr);
      const last = Number(lastStr);
      for (let num = first; num <= last; num++) {
        results.push({
          path: `/portraits/portrait-${num}.jpg`,
          species,
          sex,
          className: '',
        });
      }
    }
    const namedRegex = /\{\s*fileName:\s*'([^']+)',\s*species:\s*'([^']+)',\s*sex:\s*'([^']+)',\s*className:\s*'([^']*)'\s*\}/g;
    while ((m = namedRegex.exec(src)) !== null) {
      const [, fileName, species, sex, className] = m;
      results.push({
        path: `/portraits/${fileName}`,
        species,
        sex,
        className,
      });
    }
    return results;
  } catch {
    return [];
  }
}

function getPortraitPlugin(projectRoot) {
  const dir = resolvePortraitDbDir(projectRoot);
  const available = fs.existsSync(dir) && fs.existsSync(path.join(dir, 'portraits'));
  if (!available) {
    return { available: false, id: 'portraitdb', label: 'portraitdb', portraits: [] };
  }
  const builtIn = loadBuiltInFromPlugin(dir);
  const custom = listCustomPortraits(projectRoot);
  return {
    available: true,
    id: 'portraitdb',
    label: 'portraitdb',
    portraits: [...builtIn, ...custom],
  };
}

module.exports = {
  listCustomPortraits,
  addCustomPortrait,
  getPortraitPlugin,
};
