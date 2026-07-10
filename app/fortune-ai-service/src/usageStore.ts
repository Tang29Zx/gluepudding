import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { FortuneAccessClass, FortuneAiModule } from "./contracts.js";

interface UsageRow {
  actual_nano_usd: number;
  completion_tokens: number;
  prompt_cache_hit_tokens: number;
  prompt_cache_miss_tokens: number;
  request_count: number;
  reserved_nano_usd: number;
}

export interface UsageRecord {
  completionTokens: number;
  costNanoUsd: number;
  promptCacheHitTokens: number;
  promptCacheMissTokens: number;
}

export interface UsageSnapshot {
  admin: UsageRow;
  day: string;
  normal: UsageRow;
}

const emptyUsageRow: UsageRow = {
  actual_nano_usd: 0,
  completion_tokens: 0,
  prompt_cache_hit_tokens: 0,
  prompt_cache_miss_tokens: 0,
  request_count: 0,
  reserved_nano_usd: 0,
};

export class UsageStore {
  private readonly database: Database.Database;

  constructor(databasePath: string) {
    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    this.database = new Database(databasePath);
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("foreign_keys = ON");
    this.initializeSchema();
    this.recoverReservations();
    this.pruneAuditRows();
  }

  close(): void {
    this.database.close();
  }

  consumeUserDailyLimit(
    day: string,
    userHash: string,
    limit: number,
  ): boolean {
    const transaction = this.database.transaction(() => {
      const row = this.database.prepare(`
        SELECT request_count
        FROM user_daily_usage
        WHERE day = ? AND user_hash = ?
      `).get(day, userHash) as { request_count: number } | undefined;

      if ((row?.request_count ?? 0) >= limit) return false;

      this.database.prepare(`
        INSERT INTO user_daily_usage (day, user_hash, request_count)
        VALUES (?, ?, 1)
        ON CONFLICT(day, user_hash)
        DO UPDATE SET request_count = request_count + 1
      `).run(day, userHash);
      return true;
    });

    return transaction();
  }

  reserveBudget(
    reservationId: string,
    day: string,
    amountNanoUsd: number,
    budgetNanoUsd: number,
  ): boolean {
    const transaction = this.database.transaction(() => {
      const row = this.readUsageRow(day, "normal");
      if (
        row.actual_nano_usd + row.reserved_nano_usd + amountNanoUsd >
        budgetNanoUsd
      ) {
        return false;
      }

      this.ensureUsageRow(day, "normal");
      this.database.prepare(`
        UPDATE daily_usage
        SET reserved_nano_usd = reserved_nano_usd + ?,
            request_count = request_count + 1
        WHERE day = ? AND access_class = 'normal'
      `).run(amountNanoUsd, day);
      this.database.prepare(`
        INSERT INTO reservations (id, day, amount_nano_usd, created_at)
        VALUES (?, ?, ?, ?)
      `).run(reservationId, day, amountNanoUsd, Date.now());
      return true;
    });

    return transaction();
  }

  settleReservation(
    reservationId: string,
    usage: UsageRecord | null,
  ): void {
    const transaction = this.database.transaction(() => {
      const reservation = this.database.prepare(`
        SELECT day, amount_nano_usd
        FROM reservations
        WHERE id = ?
      `).get(reservationId) as
        | { amount_nano_usd: number; day: string }
        | undefined;
      if (!reservation) return;

      const chargedCost = usage?.costNanoUsd ?? reservation.amount_nano_usd;
      this.database.prepare(`
        UPDATE daily_usage
        SET reserved_nano_usd = MAX(0, reserved_nano_usd - ?),
            actual_nano_usd = actual_nano_usd + ?,
            prompt_cache_hit_tokens = prompt_cache_hit_tokens + ?,
            prompt_cache_miss_tokens = prompt_cache_miss_tokens + ?,
            completion_tokens = completion_tokens + ?
        WHERE day = ? AND access_class = 'normal'
      `).run(
        reservation.amount_nano_usd,
        chargedCost,
        usage?.promptCacheHitTokens ?? 0,
        usage?.promptCacheMissTokens ?? 0,
        usage?.completionTokens ?? 0,
        reservation.day,
      );
      this.database.prepare("DELETE FROM reservations WHERE id = ?").run(
        reservationId,
      );
    });

    transaction();
  }

  recordAdminUsage(day: string, usage: UsageRecord | null): void {
    this.ensureUsageRow(day, "admin");
    this.database.prepare(`
      UPDATE daily_usage
      SET actual_nano_usd = actual_nano_usd + ?,
          request_count = request_count + 1,
          prompt_cache_hit_tokens = prompt_cache_hit_tokens + ?,
          prompt_cache_miss_tokens = prompt_cache_miss_tokens + ?,
          completion_tokens = completion_tokens + ?
      WHERE day = ? AND access_class = 'admin'
    `).run(
      usage?.costNanoUsd ?? 0,
      usage?.promptCacheHitTokens ?? 0,
      usage?.promptCacheMissTokens ?? 0,
      usage?.completionTokens ?? 0,
      day,
    );
  }

  appendAudit(input: {
    accessClass: FortuneAccessClass;
    costNanoUsd: number;
    day: string;
    module: FortuneAiModule;
    requestId: string;
    status: string;
    userHash: string;
  }): void {
    this.database.prepare(`
      INSERT INTO request_audit (
        request_id,
        day,
        user_hash,
        access_class,
        module,
        status,
        cost_nano_usd,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.requestId,
      input.day,
      input.userHash,
      input.accessClass,
      input.module,
      input.status,
      input.costNanoUsd,
      Date.now(),
    );
  }

  getUsage(day: string): UsageSnapshot {
    return {
      admin: this.readUsageRow(day, "admin"),
      day,
      normal: this.readUsageRow(day, "normal"),
    };
  }

  private initializeSchema(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS daily_usage (
        day TEXT NOT NULL,
        access_class TEXT NOT NULL CHECK(access_class IN ('normal', 'admin')),
        reserved_nano_usd INTEGER NOT NULL DEFAULT 0,
        actual_nano_usd INTEGER NOT NULL DEFAULT 0,
        request_count INTEGER NOT NULL DEFAULT 0,
        prompt_cache_hit_tokens INTEGER NOT NULL DEFAULT 0,
        prompt_cache_miss_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, access_class)
      );

      CREATE TABLE IF NOT EXISTS user_daily_usage (
        day TEXT NOT NULL,
        user_hash TEXT NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, user_hash)
      );

      CREATE TABLE IF NOT EXISTS reservations (
        id TEXT PRIMARY KEY,
        day TEXT NOT NULL,
        amount_nano_usd INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS request_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        day TEXT NOT NULL,
        user_hash TEXT NOT NULL,
        access_class TEXT NOT NULL,
        module TEXT NOT NULL,
        status TEXT NOT NULL,
        cost_nano_usd INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS request_audit_created_at
      ON request_audit(created_at);
    `);
  }

  private recoverReservations(): void {
    const transaction = this.database.transaction(() => {
      const reservations = this.database.prepare(`
        SELECT day, SUM(amount_nano_usd) AS amount
        FROM reservations
        GROUP BY day
      `).all() as Array<{ amount: number; day: string }>;

      for (const reservation of reservations) {
        this.ensureUsageRow(reservation.day, "normal");
        this.database.prepare(`
          UPDATE daily_usage
          SET reserved_nano_usd = MAX(0, reserved_nano_usd - ?),
              actual_nano_usd = actual_nano_usd + ?
          WHERE day = ? AND access_class = 'normal'
        `).run(reservation.amount, reservation.amount, reservation.day);
      }

      this.database.prepare("DELETE FROM reservations").run();
    });

    transaction();
  }

  private pruneAuditRows(): void {
    this.database.prepare(`
      DELETE FROM request_audit
      WHERE created_at < ?
    `).run(Date.now() - 90 * 24 * 60 * 60 * 1000);
  }

  private ensureUsageRow(
    day: string,
    accessClass: FortuneAccessClass,
  ): void {
    this.database.prepare(`
      INSERT OR IGNORE INTO daily_usage (day, access_class)
      VALUES (?, ?)
    `).run(day, accessClass);
  }

  private readUsageRow(
    day: string,
    accessClass: FortuneAccessClass,
  ): UsageRow {
    return this.database.prepare(`
      SELECT
        reserved_nano_usd,
        actual_nano_usd,
        request_count,
        prompt_cache_hit_tokens,
        prompt_cache_miss_tokens,
        completion_tokens
      FROM daily_usage
      WHERE day = ? AND access_class = ?
    `).get(day, accessClass) as UsageRow | undefined ?? { ...emptyUsageRow };
  }
}
