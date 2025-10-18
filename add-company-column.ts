import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  try {
    await db.execute(sql`ALTER TABLE cnabFiles ADD COLUMN company VARCHAR(255) AFTER filePath`);
    console.log('✅ Coluna company adicionada com sucesso!');
  } catch (error: any) {
    if (error.message?.includes('Duplicate column')) {
      console.log('✅ Coluna company já existe!');
    } else {
      console.error('❌ Erro:', error.message);
    }
  }
  process.exit(0);
})();

