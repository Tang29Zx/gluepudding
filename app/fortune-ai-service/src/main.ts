import "dotenv/config";
import { AuthClient } from "./authClient.js";
import { readConfig } from "./config.js";
import { loadFortuneData } from "./fortuneData.js";
import { FortuneAiService } from "./fortuneAiService.js";
import { ProviderClient } from "./providerClient.js";
import { PerUserMinuteLimiter } from "./rateLimiter.js";
import { createFortuneAiHttpServer } from "./server.js";
import { UsageStore } from "./usageStore.js";

const config = readConfig();
const usageStore = new UsageStore(config.databasePath);
const service = new FortuneAiService(
  config,
  loadFortuneData(),
  new ProviderClient(config),
  new PerUserMinuteLimiter(config.perUserMinuteLimit),
  usageStore,
);
const server = createFortuneAiHttpServer({
  authClient: new AuthClient(config),
  config,
  service,
  usageStore,
});

server.listen(config.port, config.host, () => {
  console.info(JSON.stringify({
    enabled: config.enabled && Boolean(config.apiKey),
    host: config.host,
    port: config.port,
    service: "fortune-ai",
  }));
});

function shutdown(signal: string): void {
  console.info(JSON.stringify({ service: "fortune-ai", signal }));
  server.close(() => {
    usageStore.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
