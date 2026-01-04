import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy configuration for Moodle
app.use('/moodle', createProxyMiddleware({
  target: 'http://20.0.121.215',
  changeOrigin: true,
  pathRewrite: {
    '^/moodle': '', // remove /moodle from the request
  },
  onProxyRes: (proxyRes, req, res) => {
    // Rewrite Location header if it's a redirect to the absolute original URL
    if (proxyRes.headers['location']) {
      proxyRes.headers['location'] = proxyRes.headers['location'].replace('http://20.0.121.215', '/moodle');
    }
  },
  cookieDomainRewrite: "", // Rewrite cookie domains to current host
  secure: false, // Set to true if target is https
}));

// Serve static files from the Vite build directory
app.use(express.static(path.join(__dirname, 'dist')));

// For any other request, send back index.html (SPA routing support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
