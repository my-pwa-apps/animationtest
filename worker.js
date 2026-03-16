/**
 * Cloudflare Worker — AI Image Generator + CORS proxy
 * Uses Cloudflare Workers AI (free tier) for image generation.
 * Deploy: npx wrangler deploy worker.js --name ai-image-proxy
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ── /generate — AI image generation via Cloudflare Workers AI ──
    if (url.pathname === '/generate' && request.method === 'POST') {
      try {
        const { prompt, width, height } = await request.json();
        if (!prompt) {
          return jsonResponse({ error: 'prompt is required' }, 400);
        }

        // Use Stable Diffusion XL via Cloudflare AI
        const result = await env.AI.run(
          '@cf/stabilityai/stable-diffusion-xl-base-1.0',
          { prompt, width: width || 1024, height: height || 1024 }
        );

        // result is a ReadableStream of PNG bytes
        return new Response(result, {
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'image/png',
          },
        });
      } catch (err) {
        return jsonResponse({ error: err.message || 'AI generation failed' }, 500);
      }
    }

    // ── /proxy/<url> — CORS proxy for external APIs ──
    if (url.pathname.startsWith('/proxy/')) {
      const targetPath = url.pathname.replace(/^\/proxy\//, '');
      if (!targetPath) {
        return jsonResponse({ error: 'Usage: /proxy/<encoded-target-url>' }, 400);
      }

      const targetUrl = decodeURIComponent(targetPath) + url.search;
      const ALLOWED = ['https://image.pollinations.ai', 'https://api.pollinations.ai'];
      if (!ALLOWED.some(o => targetUrl.startsWith(o))) {
        return jsonResponse({ error: 'Target not allowed' }, 403);
      }

      const resp = await fetch(new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' ? request.body : undefined,
      }));

      return new Response(resp.body, {
        status: resp.status,
        headers: { ...Object.fromEntries(resp.headers), ...CORS_HEADERS },
      });
    }

    return jsonResponse({ endpoints: ['/generate (POST)', '/proxy/<url>'] }, 200);
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
