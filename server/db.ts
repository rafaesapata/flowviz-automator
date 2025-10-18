import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      id: user.id,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role === undefined) {
      if (user.id === ENV.ownerId) {
        user.role = 'admin';
        values.role = 'admin';
        updateSet.role = 'admin';
      }
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Queries para CNAB
import { cnabFiles, cnabLogs, InsertCnabFile, InsertCnabLog } from "../drizzle/schema";
import { desc } from "drizzle-orm";

export async function createCnabFile(file: InsertCnabFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(cnabFiles).values(file);
  // Retornar o ID gerado pelo autoincrement
  return result[0].insertId;
}

export async function getCnabFiles(userId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cnabFiles).where(eq(cnabFiles.userId, userId)).orderBy(desc(cnabFiles.uploadedAt));
}



export async function createCnabLog(log: InsertCnabLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(cnabLogs).values(log);
}

export async function getCnabLogs(fileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cnabLogs).where(eq(cnabLogs.fileId, fileId)).orderBy(desc(cnabLogs.timestamp));
}

export async function listCnabFiles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cnabFiles).orderBy(desc(cnabFiles.createdAt));
}

export async function getCnabFile(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(cnabFiles).where(eq(cnabFiles.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateCnabFileStatus(id: number, status: string, qprofNumber?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = { status, processedAt: new Date() };
  if (qprofNumber) updateData.qprofNumber = qprofNumber;
  await db.update(cnabFiles).set(updateData).where(eq(cnabFiles.id, id));
}

export async function addLog(fileId: number, message: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Sanitizar e limitar tamanho da mensagem
  let sanitized = message.replace(/\x00/g, '').substring(0, 5000);
  
  await db.insert(cnabLogs).values({
    fileId: fileId.toString(),
    message: sanitized,
  });
}

export async function getFileLogs(fileId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cnabLogs).where(eq(cnabLogs.fileId, fileId.toString())).orderBy(desc(cnabLogs.timestamp));
}


export async function addScreenshot(data: { fileId: number; step: number; name: string; path: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { cnabScreenshots } = await import("../drizzle/schema");
  
  await db.insert(cnabScreenshots).values({
    fileId: data.fileId,
    step: data.step,
    name: data.name,
    path: data.path,
  });
}

