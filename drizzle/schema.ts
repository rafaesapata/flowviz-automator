import { mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  id: varchar("id", { length: 64 }).primaryKey(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileSize: varchar("fileSize", { length: 64 }),
  status: mysqlEnum("status", ["pending", "processing", "completed", "error"]).default("pending").notNull(),
  qprofNumber: varchar("qprofNumber", { length: 64 }),
  uploadedAt: timestamp("uploadedAt").defaultNow(),
  processedAt: timestamp("processedAt"),
  userId: varchar("userId", { length: 64 }).notNull(),
});

export const cnabLogs = mysqlTable("cnabLogs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  fileId: varchar("fileId", { length: 64 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  level: mysqlEnum("level", ["info", "warning", "error", "success"]).notNull(),
  message: text("message").notNull(),
  details: text("details"),
});

export type CnabFile = typeof cnabFiles.$inferSelect;
export type InsertCnabFile = typeof cnabFiles.$inferInsert;
export type CnabLog = typeof cnabLogs.$inferSelect;
export type InsertCnabLog = typeof cnabLogs.$inferInsert;
