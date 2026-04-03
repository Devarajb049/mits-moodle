// Node.js serverless function for proxying Moodle requests
// This handles cookie forwarding and URL rewriting for the Moodle login flow

const MOODLE_BASE = 'https://mitsmoodle.mits.ac.in';

export default async function handler(req, res) {
  // Get the path from the URL
  const pathSegments = req.url.replace(/^\/api\/moodle\/?/, '') || '';
  const moodleUrl = `${MOODLE_BASE}/${pathSegments}`;

  console.log('[v0] Proxying request to:', moodleUrl);
  console.log('[v0] Method:', req.method);

  try {
    // Prepare headers to forward
    const headers = {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.5',
    };

    // Forward cookies
    if (req.headers.cookie) {
      headers['Cookie'] = req.headers.cookie;
      console.log('[v0] Forwarding cookies');
    }

    // Handle content type for POST requests
    if (req.method === 'POST') {
      headers['Content-Type'] = req.headers['content-type'] || 'application/x-www-form-urlencoded';
    }

    // Prepare fetch options
    const fetchOptions = {
      method: req.method,
      headers,
      redirect: 'manual', // Handle redirects manually to track the final URL
    };

    // Handle request body for POST
    if (req.method === 'POST' && req.body) {
      // Body is already parsed by Vercel, need to re-encode it
      if (typeof req.body === 'object') {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(req.body)) {
          params.append(key, value);
        }
        fetchOptions.body = params.toString();
      } else {
        fetchOptions.body = req.body;
      }
      console.log('[v0] POST body prepared');
    }

    // Make the request to Moodle
    let response = await fetch(moodleUrl, fetchOptions);
    let finalUrl = moodleUrl;

    // Follow redirects manually to track the final URL
    let redirectCount = 0;
    while (response.status >= 300 && response.status < 400 && redirectCount < 10) {
      let location = response.headers.get('location');
      if (!location) break;

      // Handle relative URLs
      if (location.startsWith('/')) {
        location = `${MOODLE_BASE}${location}`;
      } else if (!location.startsWith('http')) {
        location = new URL(location, finalUrl).href;
      }

      console.log('[v0] Following redirect to:', location);
      finalUrl = location;

      // Forward cookies from redirect response
      const setCookies = response.headers.get('set-cookie');
      if (setCookies) {
        headers['Cookie'] = (headers['Cookie'] ? headers['Cookie'] + '; ' : '') + 
          setCookies.split(',').map(c => c.split(';')[0]).join('; ');
      }

      response = await fetch(location, {
        method: 'GET',
        headers,
        redirect: 'manual',
      });
      redirectCount++;
    }

    console.log('[v0] Final URL:', finalUrl);
    console.log('[v0] Response status:', response.status);

    // Get the response body
    const contentType = response.headers.get('content-type') || 'text/html';
    let body;

    if (contentType.includes('text') || contentType.includes('html') || contentType.includes('json')) {
      body = await response.text();
      
      // Rewrite URLs in HTML responses to go through our proxy
      if (contentType.includes('html')) {
        // Inject the final URL as a comment at the top so axios can read it
        const urlComment = `<!-- FINAL_URL:${finalUrl.replace(MOODLE_BASE, '/moodle')} -->`;
        body = urlComment + body;
        
        // Rewrite absolute Moodle URLs to use our proxy
        body = body.replace(/https?:\/\/mitsmoodle\.mits\.ac\.in/g, '/moodle');
        body = body.replace(/https?:\/\/20\.0\.121\.215/g, '/moodle');
      }
    } else {
      // Binary content
      body = Buffer.from(await response.arrayBuffer());
    }

    // Forward Set-Cookie headers
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      // Parse and modify cookies for our domain
      const cookies = setCookie.split(/,(?=\s*\w+=)/).map(cookie => {
        // Remove domain and secure flags for local development compatibility
        return cookie
          .replace(/;\s*domain=[^;]*/gi, '')
          .replace(/;\s*secure/gi, '')
          .replace(/;\s*samesite=none/gi, '; SameSite=Lax');
      });
      res.setHeader('Set-Cookie', cookies);
      console.log('[v0] Set-Cookie headers forwarded');
    }

    // Set response headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Final-URL', finalUrl.replace(MOODLE_BASE, '/moodle'));
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'X-Final-URL');

    // Send response
    res.status(response.status);
    res.send(body);

  } catch (error) {
    console.error('[v0] Proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy error', 
      message: error.message,
      url: moodleUrl 
    });
  }
}

// Configure body parsing
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
