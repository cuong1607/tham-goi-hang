// ============================================================
// Database — SQLite singleton với better-sqlite3
// ============================================================

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { AliasRow } from "./order-check/types";

// Lưu DB trong thư mục gốc project (không commit lên git)
const DB_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "order-check.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  // Tạo thư mục nếu chưa có
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sample_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alias_raw_name TEXT NOT NULL,
      alias_normalized_name TEXT NOT NULL,
      target_raw_name TEXT NOT NULL,
      target_normalized_name TEXT NOT NULL,
      confidence REAL DEFAULT 0,
      confirmed_by_user INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_check_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_sheet_url TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_check_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      input_text TEXT NOT NULL,
      inventory_source TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bali_check_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_sheet_url TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ---- Settings ----

export function getSettings(): { google_sheet_url: string } {
  const db = getDb();
  const row = db
    .prepare("SELECT google_sheet_url FROM order_check_settings ORDER BY id DESC LIMIT 1")
    .get() as { google_sheet_url: string } | undefined;
  return row ?? { google_sheet_url: "" };
}

export function saveSettings(googleSheetUrl: string): void {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM order_check_settings ORDER BY id DESC LIMIT 1")
    .get() as { id: number } | undefined;

  if (existing) {
    db.prepare(
      "UPDATE order_check_settings SET google_sheet_url = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(googleSheetUrl, existing.id);
  } else {
    db.prepare(
      "INSERT INTO order_check_settings (google_sheet_url) VALUES (?)"
    ).run(googleSheetUrl);
  }
}

// ---- Aliases ----

export function getAllAliases(): AliasRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM sample_aliases WHERE confirmed_by_user = 1")
    .all() as AliasRow[];
}

export function upsertAlias(
  aliasRawName: string,
  aliasNormalizedName: string,
  targetRawName: string,
  targetNormalizedName: string,
  confidence: number,
  confirmedByUser: boolean
): void {
  const db = getDb();
  const existing = db
    .prepare(
      "SELECT id FROM sample_aliases WHERE alias_normalized_name = ? AND target_normalized_name = ?"
    )
    .get(aliasNormalizedName, targetNormalizedName) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE sample_aliases
       SET confirmed_by_user = ?, confidence = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(confirmedByUser ? 1 : 0, confidence, existing.id);
  } else {
    db.prepare(
      `INSERT INTO sample_aliases
       (alias_raw_name, alias_normalized_name, target_raw_name, target_normalized_name, confidence, confirmed_by_user)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      aliasRawName,
      aliasNormalizedName,
      targetRawName,
      targetNormalizedName,
      confidence,
      confirmedByUser ? 1 : 0
    );
  }
}

// ---- History ----

export function saveHistory(
  inputText: string,
  inventorySource: string,
  resultJson: unknown
): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO order_check_history (input_text, inventory_source, result_json) VALUES (?, ?, ?)"
  ).run(inputText, inventorySource, JSON.stringify(resultJson));
}

// ---- Bali Check Settings ----

export function getBaliSettings(): { google_sheet_url: string } {
  const db = getDb();
  const row = db
    .prepare("SELECT google_sheet_url FROM bali_check_settings ORDER BY id DESC LIMIT 1")
    .get() as { google_sheet_url: string } | undefined;
  return row ?? { google_sheet_url: "" };
}

export function saveBaliSettings(googleSheetUrl: string): void {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM bali_check_settings ORDER BY id DESC LIMIT 1")
    .get() as { id: number } | undefined;

  if (existing) {
    db.prepare(
      "UPDATE bali_check_settings SET google_sheet_url = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(googleSheetUrl, existing.id);
  } else {
    db.prepare(
      "INSERT INTO bali_check_settings (google_sheet_url) VALUES (?)"
    ).run(googleSheetUrl);
  }
}
