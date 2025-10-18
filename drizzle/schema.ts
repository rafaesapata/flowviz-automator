import { mysqlEnum, mysqlTable, text, timestamp, varchar, int, serial } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Tabelas da automação CNAB
export const cnabFiles = mysqlTable("cnabFiles", {
  id: int("id").primaryKey().autoincrement(),
  filename: varchar("filename", { length: 255 }).notNull(),
  filePath: varchar("filePath", { length: 500 }).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "error"]).default("pending").notNull(),
  qprofNumber: varchar("qprofNumber", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
  processedAt: timestamp("processedAt"),
});

export const cnabLogs = mysqlTable("cnabLogs", {
  id: int("id").primaryKey().autoincrement(),
  fileId: varchar("fileId", { length: 64 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  message: text("message").notNull(),
});

export const cnabScreenshots = mysqlTable("cnabScreenshots", {
  id: int("id").primaryKey().autoincrement(),
  fileId: int("fileId").notNull(),
  step: int("step").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type CnabFile = typeof cnabFiles.$inferSelect;
export type InsertCnabFile = typeof cnabFiles.$inferInsert;
export type CnabLog = typeof cnabLogs.$inferSelect;
export type InsertCnabLog = typeof cnabLogs.$inferInsert;
export type CnabScreenshot = typeof cnabScreenshots.$inferSelect;
export type InsertCnabScreenshot = typeof cnabScreenshots.$inferInsert;
