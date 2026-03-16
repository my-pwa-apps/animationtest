/**
 * Cloudflare Worker — CORS proxy for Pollinations API
 * Deploy: npx wrangler deploy worker.js --name ai-image-proxy
 *
 * Only proxies requests to allowed origins (Pollinations).
 */

const ALLOWED_TARGETS = [
  'https://image.pollinations.ai',
  'https://api.pollinations.ai',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Extract the target URL from the path: /proxy/<encoded-url>
    const targetPath = url.pathname.replace(/^\/proxy\//, '');
    if (!targetPath) {
      return new Response(JSON.stringify({ error: 'Usage: /proxy/<encoded-target-url>' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const targetUrl = decodeURIComponent(targetPath) + url.search;

    // Validate the target is an allowed origin
    const isAllowed = ALLOWED_TARGETS.some(origin => targetUrl.startsWith(origin));
    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Target not allowed' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Forward the request
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' ? request.body : undefined,
    });

    const response = await fetch(proxyRequest);

    // Return the response with CORS headers
    const proxyResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: { ...Object.fromEntries(response.headers), ...CORS_HEADERS },
    });

    return proxyResponse;
  },
};
