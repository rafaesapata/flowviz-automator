import { getDb } from './db';
import { cnabScreenshots } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

export async function listScreenshots(fileId: number) {
  try {
    const db = await getDb();
    if (!db) return [];
    
    const screenshots = await db
      .select()
      .from(cnabScreenshots)
      .where(eq(cnabScreenshots.fileId, fileId))
      .orderBy(cnabScreenshots.step);
    
    return screenshots;
  } catch (error) {
    console.error('Erro ao listar screenshots:', error);
    return [];
  }
}

