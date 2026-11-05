import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Nieprawidłowy PORT');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
export const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if(name==='/iskra-board') {res.writeHead(302,{Location:'/iskra-board/'});res.end();return}
    if(name.startsWith('/iskra-board/'))name=name.slice('/iskra-board'.length);
    if (name === '/config.local.js') {
      res.setHeader('Content-Type', types['.js']);
      const content = await readFile(path.join(root, name.slice(1)), 'utf8').catch(e => {
        if (e.code === 'ENOENT') return '// Optional local configuration is absent.\n';
        throw e;
      });
      res.end(req.method === 'HEAD' ? undefined : content); return;
    }
    const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(root + path.sep) || name.split('/').some(part => part.startsWith('.'))) {
      res.writeHead(403); res.end(); return;
    }
    const body = await readFile(file);
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (e) { res.writeHead(e.code === 'ENOENT' ? 404 : 400); res.end('Nie znaleziono pliku lub nieprawidłowe żądanie'); }
});
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} jest zajęty. Ustaw inny PORT.` : 'Nie udało się uruchomić serwera.'); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Iskra: http://localhost:${port} — zatrzymaj przez Ctrl+C`));
