// Node.js serverless function for proxying Moodle requests
// This handles cookie forwarding and URL rewriting for the Moodle login flow

const MOODLE_BASE = 'https://mitsmoodle.mits.ac.in';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }

  // Get the path from the URL
  let pathSegments = req.url.replace(/^\/api\/moodle\/?/, '').replace(/^\?/, '') || '';
  
  // Handle query string
  const urlParts = pathSegments.split('?');
  const path = urlParts[0];
  const queryString = urlParts[1] || '';
  
  const moodleUrl = queryString 
    ? `${MOODLE_BASE}/${path}?${queryString}`
    : `${MOODLE_BASE}/${path}`;

  try {
    // Use realistic browser headers to avoid 403
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'Referer': `${MOODLE_BASE}/`,
      'Origin': MOODLE_BASE,
    };

    // Forward cookies from client
    if (req.headers.cookie) {
      headers['Cookie'] = req.headers.cookie;
    }

    // Handle content type for POST requests
    if (req.method === 'POST') {
      headers['Content-Type'] = req.headers['content-type'] || 'application/x-www-form-urlencoded';
      headers['Sec-Fetch-Site'] = 'same-origin';
    }

    // Prepare fetch options
    const fetchOptions = {
      method: req.method,
      headers,
      redirect: 'manual', // Handle redirects manually to track the final URL
    };

    // Handle request body for POST
    if (req.method === 'POST' && req.body) {
      if (typeof req.body === 'object') {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(req.body)) {
          params.append(key, value);
        }
        fetchOptions.body = params.toString();
      } else {
        fetchOptions.body = req.body;
      }
    }

    // Make the request to Moodle
    let response = await fetch(moodleUrl, fetchOptions);
    let finalUrl = moodleUrl;
    let allCookies = [];

    // Collect Set-Cookie headers
    const collectCookies = (resp) => {
      const setCookieHeader = resp.headers.get('set-cookie');
      if (setCookieHeader) {
        // Split multiple cookies properly
        const cookies = setCookieHeader.split(/,(?=[^;]+=[^;]+)/);
        allCookies.push(...cookies);
      }
    };

    collectCookies(response);

    // Follow redirects manually to track the final URL
    let redirectCount = 0;
    while ((response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308) && redirectCount < 10) {
      let location = response.headers.get('location');
      if (!location) break;

      // Handle relative URLs
      if (location.startsWith('/')) {
        location = `${MOODLE_BASE}${location}`;
      } else if (!location.startsWith('http')) {
        location = new URL(location, finalUrl).href;
      }

      finalUrl = location;

      // Update cookies from redirect for next request
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        const newCookies = setCookieHeader.split(/,(?=[^;]+=[^;]+)/).map(c => c.split(';')[0].trim());
        const existingCookies = headers['Cookie'] ? headers['Cookie'].split('; ') : [];
        
        // Merge cookies
        const cookieMap = {};
        existingCookies.forEach(c => {
          const [name, ...rest] = c.split('=');
          if (name) cookieMap[name.trim()] = rest.join('=');
        });
        newCookies.forEach(c => {
          const [name, ...rest] = c.split('=');
          if (name) cookieMap[name.trim()] = rest.join('=');
        });
        
        headers['Cookie'] = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
      }

      response = await fetch(location, {
        method: 'GET',
        headers,
        redirect: 'manual',
      });
      
      collectCookies(response);
      redirectCount++;
    }

    // Get the response body
    const contentType = response.headers.get('content-type') || 'text/html';
    let body;

    if (contentType.includes('text') || contentType.includes('html') || contentType.includes('json') || contentType.includes('javascript')) {
      body = await response.text();
      
      // Rewrite URLs in HTML responses to go through our proxy
      if (contentType.includes('html')) {
        // Inject the final URL as a comment at the top so the client can read it
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
    if (allCookies.length > 0) {
      const modifiedCookies = allCookies.map(cookie => {
        return cookie
          .replace(/;\s*domain=[^;]*/gi, '')
          .replace(/;\s*secure/gi, '')
          .replace(/;\s*samesite=none/gi, '; SameSite=Lax')
          .replace(/;\s*path=\/(?![\w])/gi, '; Path=/');
      });
      res.setHeader('Set-Cookie', modifiedCookies);
    }

    // Set response headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Final-URL', finalUrl.replace(MOODLE_BASE, '/moodle'));
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'X-Final-URL, Set-Cookie');

    // Send response
    res.status(response.status);
    res.send(body);

  } catch (error) {
    console.error('Proxy error:', error);
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
