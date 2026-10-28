import { createServer } from 'node:http';
import { createAlerter, fileCursorStore, telegramSender } from './alerts.ts';
import { loadConfig } from './config.ts';
import { createOpsData } from './data.ts';
import { relayHealth } from './health.ts';
import { createRateLimiter } from './rateLimit.ts';
import { createHandler } from './server.ts';

const POLL_MS = 2 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

const cfg = loadConfig(process.env);
const now = Date.now;
const data = createOpsData({ supabaseUrl: cfg.supabaseUrl, serviceKey: cfg.serviceKey });

const handler = createHandler({
  sessionSecret: cfg.sessionSecret,
  adminIds: cfg.adminIds,
  publicOrigin: cfg.publicOrigin,
  login: {
    supabaseUrl: cfg.supabaseUrl,
    anonKey: cfg.anonKey,
    adminIds: cfg.adminIds,
    perIp: createRateLimiter(5, WINDOW_MS, now),
    global: createRateLimiter(30, WINDOW_MS, now),
  },
  data,
  health: relayHealth(cfg.relayStatusUrl, cfg.relayStatusToken, now),
  now,
});

createServer(handler).listen(cfg.port, () => console.log(`deck-ops listening on :${cfg.port}`));

if (!cfg.telegram) {
  console.log('alerts: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set, Telegram alerts disabled');
} else {
  const alerter = createAlerter({
    data,
    cursor: fileCursorStore(cfg.cursorFile),
    send: telegramSender(cfg.telegram.token, cfg.telegram.chatId),
    now,
    publicUrl: cfg.publicUrl,
  });
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await alerter.tick(); } catch (e) { console.error(`alerts: ${(e as Error).message}`); } finally { running = false; }
  };
  void tick();
  setInterval(tick, POLL_MS).unref();
}
