import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isNgrok = process.env.VITE_NGROK_MODE === "true";

  return {
    base: "/",
    server: {
      host: "0.0.0.0",
      port: 3050,
      strictPort: false,
      allowedHosts: "all",
      hmr: isNgrok ? false : true,
      middlewareMode: false,
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      minify: "esbuild",
      terserOptions: {
        compress: {
          drop_console: false,
        },
        mangle: {
          reserved: ["React", "ReactDOM"],
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
          },
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  };
});
