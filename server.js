const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
// Note: As per securecoder guidelines, test servers must bind strictly to 127.0.0.1
const HOST = '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // Simple router
  if (req.method === 'POST' && req.url === '/api/publish') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (payload.html || payload.storesJSON) {
          if (payload.html) {
            fs.writeFileSync(path.join(__dirname, 'index.html'), payload.html, 'utf8');
          }
          if (payload.storesJSON) {
            const content = `window.STREAMLINE_STORE_DATA = ${JSON.stringify(payload.storesJSON, null, 2)};`;
            fs.writeFileSync(path.join(__dirname, 'assets', 'stores.js'), content, 'utf8');
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No html field in payload' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Serve static files for GET requests
  if (req.method === 'GET') {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    // Remove query strings like ?v=2
    filePath = filePath.split('?')[0];
    
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const fullPath = path.join(__dirname, filePath);

    fs.readFile(fullPath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('File not found');
        } else {
          res.writeHead(500);
          res.end(`Server Error: ${err.code}`);
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data, 'utf-8');
      }
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
  console.log(`Live publishing is enabled. Admin changes will modify index.html.`);
});
