import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Stream Proxy endpoint - Solves Mixed Content (HTTP/HTTPS) and CORS restrictions
  app.get('/api/stream-proxy', async (req: Request, res: Response) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      res.status(400).send('URL de transmissão ausente.');
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
        res
          .status(upstreamResponse.status)
          .send(`Erro ao buscar sinal da emissora: ${upstreamResponse.statusText}`);
        return;
      }

      const contentType = upstreamResponse.headers.get('content-type') || '';
      const isM3u8 =
        targetUrl.toLowerCase().includes('.m3u8') ||
        contentType.includes('mpegurl') ||
        contentType.includes('application/x-mpegURL') ||
        contentType.includes('vnd.apple.mpegurl');

      // Set universal CORS headers for video streaming
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (isM3u8) {
        const text = await upstreamResponse.text();

        // If it starts with #EXTM3U or looks like a playlist, rewrite the lines
        if (text.includes('#EXTM3U')) {
          const lines = text.split('\n');
          const rewritten = lines
            .map((line) => {
              const trimmed = line.trim();
              if (!trimmed) return line;

              // Check for tags containing URI="..." (such as audio, subtitles, or encryption keys)
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

              // Comments or header tags
              if (trimmed.startsWith('#')) {
                return line;
              }

              // Stream segment or sub-playlist URI line
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
          res.send(rewritten);
          return;
        }
      }

      // Binary media segments (.ts, .m4s, .mp4, audio) or direct pass-through
      res.setHeader('Content-Type', contentType || 'video/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      if (upstreamResponse.body) {
        // Stream directly using web stream to node response
        const arrayBuffer = await upstreamResponse.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
      } else {
        res.end();
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        res.status(504).send('Tempo esgotado ao conectar com a emissora.');
      } else {
        res.status(502).send(`Falha na conexão com o servidor de transmissão: ${err.message}`);
      }
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Brasil TV Aberta Proxy' });
  });

  // Development vs Production serving
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Brasil TV Aberta rodando na porta ${PORT}`);
  });
}

startServer();
