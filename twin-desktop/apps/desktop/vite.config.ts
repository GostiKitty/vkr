import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const isProductionWeb = mode === "production";

  return {
  plugins: [react()],
  define: {
    "import.meta.env.VITE_ENGINE_BASE": JSON.stringify(
      isProductionWeb ? (process.env.VITE_ENGINE_BASE ?? "") : "http://127.0.0.1:8010"
    ),
    "import.meta.env.VITE_WEB_DEMO": JSON.stringify(isProductionWeb ? "true" : "false"),
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  };
});