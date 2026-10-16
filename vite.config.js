import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite dev proxy: forwards /api/copilot -> api.githubcopilot.com, /api/models -> models.github.ai, /api/gh -> api.github.com
// This bypasses browser CORS restrictions during development.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/models": {
        target: "https://models.github.ai",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/models/, ""),
        secure: true,
      },
      "/api/copilot": {
        target: "https://api.githubcopilot.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/copilot/, ""),
        secure: true,
        headers: {
          "Copilot-Integration-Id": "vscode-chat",
          "Editor-Version": "vscode/1.95.0",
          "User-Agent": "GithubCopilot/1.0",
        },
      },
      "/api/gh": {
        target: "https://api.github.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gh/, ""),
        secure: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
