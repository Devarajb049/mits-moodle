import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/moodle': {
        target: 'http://20.0.121.215',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "",
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Rewrite Location header if it's a redirect to the absolute original URL
            if (proxyRes.headers['location']) {
              proxyRes.headers['location'] = proxyRes.headers['location'].replace('http://20.0.121.215', '/moodle');
            }
          });
        },
        rewrite: (path) => path.replace(/^\/moodle/, '')
      }
    }
  }
})
