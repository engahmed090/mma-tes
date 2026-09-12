import { nodeChat } from './server/nodeChat';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const privateEnv = loadEnv(mode, process.cwd(), '');
  for (const name of ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'GROQ_API_KEY', 'GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_MODEL', 'TAVILY_API_KEY']) {
    if (!process.env[name] && privateEnv[name]) process.env[name] = privateEnv[name];
  }
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (mode === 'production') {
    for (const name of ['VITE_PREDICTION_API_URL', 'VITE_STREAMLIT_URL', 'VITE_AI_CHAT_API_URL']) {
      const value = env[name]?.trim();
      if (!value) continue;
      const url = new URL(value);
      if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname) || url.hostname.endsWith('.localhost'))
        throw new Error(`${name} must use a public HTTPS service URL for production, or be empty.`);
    }
  }
  return ({
  server: {
    host: "127.0.0.1",
    port: 8080,
    strictPort: true,
    proxy: { "/api": { target: process.env.PREDICTION_PROXY_TARGET || "http://127.0.0.1:8000", changeOrigin: true } },
    hmr: {
      overlay: false,
    },
  },
  plugins: [{ name: 'local-ai-chat', configureServer(server: ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0].replace(/\/$/, '') === '/api/ai-chat') void nodeChat(req, res);
      else next();
    });
  } }, react(), mode === "development" && componentTagger(), {
    name: 'deployment-metadata',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'deployment.json', source: JSON.stringify({
        commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local-build',
        branch: process.env.VERCEL_GIT_COMMIT_REF || 'local',
        application: 'Experimental Sensing Lab',
      }) });
    },
  } as Plugin].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
});
});
