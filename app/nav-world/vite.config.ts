import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

function preloadWorldExperienceChunk(): PluginOption {
  return {
    name: "preload-world-experience-chunk",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, context) {
        const worldChunk = Object.values(context.bundle ?? {}).find(
          (outputItem) =>
            outputItem.type === "chunk" &&
            outputItem.facadeModuleId?.endsWith("/src/world/WorldExperience.tsx"),
        );

        if (!worldChunk) {
          return [];
        }

        return [
          {
            tag: "link",
            injectTo: "head-prepend",
            attrs: {
              rel: "modulepreload",
              crossorigin: true,
              href: `./${worldChunk.fileName}`,
            },
          },
        ];
      },
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), preloadWorldExperienceChunk()],
  build: {
    outDir: "../frontend",
    emptyOutDir: false,
  },
});
