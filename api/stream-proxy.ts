import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string | string[]> },
  res: ServerResponse & {
    status?: (code: number) => any;
    send?: (body: any) => any;
    json?: (body: any) => any;
  }
) {
  // Parse target URL from query
  let targetUrl = '';
  if (req.query && req.query.url) {
    targetUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  } else if (req.url) {
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      targetUrl = urlObj.searchParams.get('url') || '';
    } catch {
      targetUrl = '';
    }
  }

  // Set universal CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!targetUrl) {
    res.statusCode = 400;
    res.end('URL de transmissão ausente.');
    return;
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const upstreamResponse = await fetch(parsedTarget.href, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        Referer: `${parsedTarget.protocol}//${parsedTarget.host}/`,
        Origin: `${parsedTarget.protocol}//${parsedTarget.host}`,
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!upstreamResponse.ok) {
      res.statusCode = upstreamResponse.status;
      res.end(`Erro ao buscar sinal da emissora: ${upstreamResponse.statusText}`);
      return;
    }

    const contentType = upstreamResponse.headers.get('content-type') || '';
    const isM3u8 =
      targetUrl.toLowerCase().includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('application/x-mpegURL') ||
      contentType.includes('vnd.apple.mpegurl');

    if (isM3u8) {
      const text = await upstreamResponse.text();

      // If it contains #EXTM3U or looks like a playlist, rewrite the lines
      if (text.includes('#EXTM3U')) {
        const lines = text.split('\n');
        const rewritten = lines
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            // Check for tags containing URI="..."
            if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
              return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
                try {
                  const resolved = new URL(uri, parsedTarget.href).href;
                  return `URI="/api/stream-proxy?url=${encodeURIComponent(resolved)}"`;
                } catch {
                  return `URI="${uri}"`;
                }
              });
            }

            // Comments or metadata tags
            if (trimmed.startsWith('#')) {
              return line;
            }

            // Segment or sub-playlist URL
            try {
              const resolved = new URL(trimmed, parsedTarget.href).href;
              return `/api/stream-proxy?url=${encodeURIComponent(resolved)}`;
            } catch {
              return line;
            }
          })
          .join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.statusCode = 200;
        res.end(rewritten);
        return;
      }
    }

    // Binary media segments (.ts, .m4s, .mp4, audio)
    res.setHeader('Content-Type', contentType || 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.statusCode = 200;

    if (upstreamResponse.body) {
      const arrayBuffer = await upstreamResponse.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
    } else {
      res.end();
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      res.statusCode = 504;
      res.end('Tempo esgotado ao conectar com a emissora.');
    } else {
      res.statusCode = 502;
      res.end(`Falha na conexão com o servidor de transmissão: ${err.message}`);
    }
  }
}
