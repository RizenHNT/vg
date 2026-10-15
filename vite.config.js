import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const publicAssets = ['/manifest.webmanifest', '/icons/app-192.png', '/icons/app-512.png', '/icons/app-maskable-512.png', '/icons/apple-touch-icon.png', '/fonts/barlow-condensed-600.ttf', '/fonts/barlow-condensed-800.ttf', '/field-circuit-blue.svg', '/field-circuit-gold.svg', '/field-circuit-guard.svg', '/symbols/vg-tech-atlas.png', '/reference-playmat.jpg'];
publicAssets.push('/skins/dragon-sanctuary.webp', '/skins/moon-grove.webp');
export default {
  root: '.',
  plugins: [{
    name: 'vg-offline-shell',
    enforce: 'post',
    apply: 'build',
    generateBundle(options, bundle) {
      const hash = createHash('sha256');
      const entry = bundle['index.html'];
      // This network entry bypasses older workers that only handle / and /index.html.
      // It shares the same origin and save key, and never clears storage or caches.
      if (entry?.type === 'asset') this.emitFile({ type:'asset', fileName:'play.html', source:entry.source });
      const template = readFileSync(new URL('./pwa/sw-template.js', import.meta.url), 'utf8');
      hash.update(template);
      hash.update(readFileSync(new URL('./index.html', import.meta.url)));
      const files = Object.keys(bundle).sort();
      files.forEach(file => { hash.update(file); hash.update(bundle[file].type === 'chunk' ? bundle[file].code : bundle[file].source); });
      publicAssets.forEach(file => { hash.update(file); hash.update(readFileSync(new URL('./public' + file, import.meta.url))); });
      const version = hash.digest('hex').slice(0, 16);
      const precache = ['/index.html', '/play.html', ...files.filter(file => file.endsWith('.js') || file.endsWith('.css')).map(file => '/' + file), ...publicAssets];
      const source = template.replace('__VERSION__', JSON.stringify(version)).replace('__PRECACHE__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  }],
  build: {
    outDir: 'dist'
  }
}
