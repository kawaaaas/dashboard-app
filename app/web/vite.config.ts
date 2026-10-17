import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 本番では部品（@acme/platform）が config.json を一緒に置く（API は同じドメインの /api/*）。
// 手元の開発（npm run dev）では、ここで同じ形の config.json を返す（API は app/api の npm run dev）。
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-config',
      configureServer(server) {
        server.middlewares.use('/config.json', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ apiUrl: 'http://localhost:8080', env: 'local' }));
        });
      },
    },
  ],
});
