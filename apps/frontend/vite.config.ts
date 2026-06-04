import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

/** Avoid Windows ECONNREFUSED on ::1 when backend listens on IPv4 only. */
function apiProxyTarget(): string {
  const raw = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000';
  try {
    const url = new URL(raw);
    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1';
    }
    return url.origin;
  } catch {
    return 'http://127.0.0.1:3000';
  }
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.FRONTEND_PORT) || 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget(),
        changeOrigin: true,
        // Reprocess runs several OpenAI calls synchronously (often 30–90s).
        timeout: 180_000,
        proxyTimeout: 180_000,
      },
    },
  },
});
