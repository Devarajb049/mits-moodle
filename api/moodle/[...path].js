export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const pathSegments = url.pathname.replace('/api/moodle/', '');
  const moodleUrl = `https://mitsmoodle.mits.ac.in/${pathSegments}${url.search}`;

  try {
    // Get cookies from the request
    const cookies = request.headers.get('cookie') || '';

    // Forward the request to Moodle
    const response = await fetch(moodleUrl, {
      method: request.method,
      headers: {
        'Content-Type': request.headers.get('content-type') || 'text/html',
        'Cookie': cookies,
        'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0',
        'Accept': request.headers.get('accept') || '*/*',
      },
      body: request.method !== 'GET' && request.method !== 'HEAD' 
        ? await request.text() 
        : undefined,
      redirect: 'manual',
    });

    // Get response headers
    const responseHeaders = new Headers();
    
    // Forward cookies from Moodle
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      responseHeaders.set('Set-Cookie', setCookie);
    }

    // Handle redirects - rewrite Moodle URLs to our proxy
    if (response.status >= 300 && response.status < 400) {
      let location = response.headers.get('location') || '';
      if (location.includes('mitsmoodle.mits.ac.in')) {
        location = location.replace('https://mitsmoodle.mits.ac.in', '/api/moodle');
      } else if (location.startsWith('/')) {
        location = `/api/moodle${location}`;
      }
      responseHeaders.set('Location', location);
      return new Response(null, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Get content type
    const contentType = response.headers.get('content-type') || 'text/html';
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Credentials', 'true');

    // Return the response
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
