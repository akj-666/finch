import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function finchBackendPlugin() {
  const attachMiddleware = (server: any) => {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url && req.url.startsWith('/api')) {
        try {
          const { handleApiRequest } = await import('./server/apiHandler.mjs');
          const handled = await handleApiRequest(req, res);
          if (handled) return;
        } catch (err) {
          console.error('Vite Backend Middleware Error:', err);
        }
      }
      next();
    });
  };

  return {
    name: 'finch-backend-api',
    configureServer: attachMiddleware,
    configurePreviewServer: attachMiddleware,
  };
}

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  plugins: [
    react(),
    tailwindcss(),
    finchBackendPlugin(),
  ],
});
