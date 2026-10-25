import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API_ROUTES = new Set(['chat', 'contact', 'transcript']);

// Serves the Vercel functions in /api during `npm run dev`, so the chat and the
// contact form behave locally the way they do in production.
function devApi(): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([a-z]+)(?:\?.*)?$/);
        if (!match || !API_ROUTES.has(match[1])) return next();

        let raw = '';
        for await (const chunk of req) raw += chunk;
        let body: unknown = {};
        try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }

        const vreq = Object.assign(req, { body });
        const vres = Object.assign(res, {
          status(code: number) { res.statusCode = code; return vres; },
          json(data: unknown) {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(data));
            return vres;
          },
        });

        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.js`);
          await mod.default(vreq, vres);
        } catch (err) {
          server.config.logger.error(String(err));
          if (!res.headersSent) vres.status(500).json({ error: 'The local API crashed. Check the terminal.' });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // The functions read their keys from process.env, as they do on Vercel.
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['GROQ_API_KEY', 'BREVO_API_KEY']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }

  return {
    plugins: [react(), tailwindcss(), devApi()],
    build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  };
});
