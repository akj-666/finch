import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './server/apiHandler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 5173;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  // Check if API request
  if (req.url && req.url.startsWith('/api')) {
    const handled = await handleApiRequest(req, res);
    if (handled) return;
  }

  // Serve static dist files
  let safePath = path.normalize(new URL(req.url, 'http://localhost').pathname);
  let filePath = path.join(DIST_DIR, safePath === '/' ? 'index.html' : safePath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.statusCode = 404;
    res.end('Not found. Please run "npm run build" first.');
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Finch System Server running at http://localhost:${PORT}`);
  console.log(`📁 System Database: ${path.join(__dirname, 'data', 'finch.db')} (SQLite)`);
  console.log(`📁 Receipts Storage: ${path.join(__dirname, 'data', 'receipts')}`);
});
