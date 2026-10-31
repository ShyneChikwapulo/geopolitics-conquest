// Copies generated/third-party assets into public/ so the browser can fetch them on demand:
//   - the 50m world topology (740 KB: kept out of the JavaScript bundle)
//   - the 234 country flags we need (about 1.5 MB, loaded one by one as they are displayed)
// Run automatically before `dev` and `build`.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pub = new URL('../public/', import.meta.url);
mkdirSync(pub, { recursive: true });

copyFileSync(require.resolve('world-atlas/countries-50m.json'), new URL('countries-50m.json', pub));

const flagsDir = new URL('flags/', pub);
mkdirSync(flagsDir, { recursive: true });
const flagsPkg = require.resolve('flag-icons/package.json').replace(/package\.json$/, '');
const countries = JSON.parse(readFileSync(new URL('../../data/src/countries.json', import.meta.url), 'utf8'));
let copied = 0;
for (const c of countries) {
  const code = String(c.iso2).toLowerCase();
  const from = `${flagsPkg}flags/4x3/${code}.svg`;
  if (!existsSync(from)) {
    console.warn(`No flag for ${c.name} (${code})`);
    continue;
  }
  copyFileSync(from, new URL(`${code}.svg`, flagsDir));
  copied++;
}
console.log(`copied countries-50m.json and ${copied} flags to public/`);
