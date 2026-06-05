import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  define: {
    __EMBER_DEV__: JSON.stringify(mode !== "production"),
  },
}));
