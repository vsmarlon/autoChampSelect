import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env": {},
    "process": {},
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.tsx"),
      name: "autochampselect",
      fileName: "index",
      formats: ["es"],
    },
    rollupOptions: {
      // Ensure we don't bundle Penguin context globals if they exist as externals
      external: [], 
      output: {
        manualChunks: undefined, // Ensure single file output
      },
    },
    minify: "esbuild",
    cssCodeSplit: false,
  },
});
