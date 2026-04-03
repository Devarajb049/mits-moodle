import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/moodle': {
        target: 'https://mitsmoodle.mits.ac.in',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "",
        headers: {
          'Origin': 'https://mitsmoodle.mits.ac.in',
          'Referer': 'https://mitsmoodle.mits.ac.in/',
        },
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Set Origin and Referer to Moodle's domain to bypass CSRF checks
            proxyReq.setHeader('Origin', 'https://mitsmoodle.mits.ac.in');
            proxyReq.setHeader('Referer', 'https://mitsmoodle.mits.ac.in' + proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Rewrite Location header if it's a redirect to the absolute original URL
            if (proxyRes.headers['location']) {
              proxyRes.headers['location'] = proxyRes.headers['location'].replace('https://mitsmoodle.mits.ac.in', '/moodle');
            }
            // Remove secure flag from cookies for local dev
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              proxyRes.headers['set-cookie'] = setCookie.map(cookie =>
                cookie.replace(/;\s*Secure/gi, '').replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
              );
            }
          });
        },
        rewrite: (path) => path.replace(/^\/moodle/, '')
      }
    }
  }
})
