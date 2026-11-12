// Собирает www/ в один самодостаточный файл dist/sdgoku.html:
// стили, скрипты, шрифты и иконки целей встроены внутрь (серверная часть в него не входит).
// Запуск: node tools/build-single.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'www');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

let html = fs.readFileSync(path.join(www, 'index.html'), 'utf8');

// CSS: встроить и заменить url(...) на data:
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => {
  const file = path.join(www, href);
  let css = fs.readFileSync(file, 'utf8');
  css = css.replace(/url\(([^)]+)\)/g, (m, ref) => {
    ref = ref.trim().replace(/^['"]|['"]$/g, '');
    if (ref.startsWith('data:')) return m;
    const asset = path.resolve(path.dirname(file), ref);
    const mime = MIME[path.extname(asset).toLowerCase()];
    if (!mime) throw new Error('Unknown asset type: ' + ref);
    return 'url(data:' + mime + ';base64,' + fs.readFileSync(asset).toString('base64') + ')';
  });
  return '<style>\n' + css + '\n</style>';
});

// JS: встроить все локальные скрипты по порядку
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const js = fs.readFileSync(path.join(www, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>\n' + js + '\n</script>';
});

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'sdgoku.html');
fs.writeFileSync(out, html);
console.log('OK', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
