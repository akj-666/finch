import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function finchBackendPlugin() {
  return {
    name: 'finch-backend-api',
    configureServer(server: any) {
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
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    finchBackendPlugin(),
  ],
});
