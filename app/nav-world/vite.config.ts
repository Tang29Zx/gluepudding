import { defineConfig, loadEnv, type PluginOption, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

const previewAllowedHosts = ["gluepudding.com", "www.gluepudding.com"];

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

function createLocalProxy(env: Record<string, string>): Record<string, ProxyOptions> {
  const fortuneAiTarget =
    env.FORTUNE_AI_SERVICE_URL || "http://127.0.0.1:3260";
  const proxy: Record<string, ProxyOptions> = {
    "/api/fortune": {
      changeOrigin: false,
      target: fortuneAiTarget,
    },
  };

  if (env.VITE_AUTH_PROXY_TARGET) {
    const authProxy: ProxyOptions = {
      changeOrigin: false,
      target: env.VITE_AUTH_PROXY_TARGET,
    };
    proxy["/api/auth"] = authProxy;
    proxy["/api/sessions"] = authProxy;
  }

  return proxy;
}

export default defineConfig(({ mode }) => {
  const env = {
    ...process.env,
    ...loadEnv(mode, ".", ""),
  } as Record<string, string>;
  const staticAssetVersion = env.VITE_STATIC_ASSET_VERSION || String(Date.now());
  const proxy = createLocalProxy(env);

  return {
    base: "./",
    define: {
      __STATIC_ASSET_VERSION__: JSON.stringify(staticAssetVersion),
    },
    plugins: [react(), preloadWorldExperienceChunk()],
    build: {
      outDir: "../frontend",
      emptyOutDir: false,
    },
    server: {
      proxy,
    },
    preview: {
      allowedHosts: previewAllowedHosts,
      proxy,
    },
  };
});
