import { z } from 'zod';
import { publicProcedure, router } from './_core/trpc';
import { simpleLogin, verifySimpleToken } from './simple-auth';
import * as db from './db';
import * as fs from 'fs';
import * as path from 'path';
import { processQProfFile } from './qprof-automation';
import { listScreenshots } from './screenshots';

export const appRouter = router({
  auth: router({
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(({ input }) => {
        const result = simpleLogin(input.email, input.password);
        if (result.success) {
          return { success: true, token: result.token, user: result.user };
        }
        throw new Error(result.error || 'Credenciais inválidas');
      }),
    me: publicProcedure
      .input(z.object({ token: z.string() }).optional())
      .query(({ input }) => {
        if (!input?.token) return null;
        const result = verifySimpleToken(input.token);
        return result.valid ? result.user : null;
      }),
    logout: publicProcedure.mutation(() => {
      return { success: true };
    }),
  }),

  cnab: router({
    uploadFile: publicProcedure
      .input(z.object({
        filename: z.string(),
        content: z.string(), // base64
      }))
      .mutation(async ({ input }) => {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const buffer = Buffer.from(input.content, 'base64');
        const filePath = path.join(uploadsDir, input.filename);
        fs.writeFileSync(filePath, buffer);

        await db.createCnabFile({
          filename: input.filename,
          filePath,
          status: 'pending',
        });

        return { success: true, filename: input.filename };
      }),

    listFiles: publicProcedure.query(async () => {
      return await db.listCnabFiles();
    }),

    processFile: publicProcedure
      .input(z.object({ fileId: z.number() }))
      .mutation(async ({ input }) => {
        const file = await db.getCnabFile(input.fileId);
        if (!file) {
          throw new Error('Arquivo não encontrado');
        }

        await db.updateCnabFileStatus(input.fileId, 'processing');
        await db.addLog(input.fileId, 'Iniciando processamento...');

        try {
          const result = await processQProfFile(input.fileId, file.filename, file.filePath);
          
          if (result.success) {
            await db.updateCnabFileStatus(input.fileId, 'completed', result.qprofNumber);
            await db.addLog(input.fileId, `Processamento concluído. Número QPROF: ${result.qprofNumber}`);
          } else {
            await db.updateCnabFileStatus(input.fileId, 'error');
            await db.addLog(input.fileId, `Erro: ${result.error}`);
          }

          return result;
        } catch (error: any) {
          await db.updateCnabFileStatus(input.fileId, 'error');
          await db.addLog(input.fileId, `Erro ao processar arquivo: ${error.message}`);
          throw error;
        }
      }),

    getFileLogs: publicProcedure
      .input(z.object({ fileId: z.number() }))
      .query(async ({ input }) => {
        return await db.getFileLogs(input.fileId);
      }),

    getScreenshots: publicProcedure
      .input(z.object({ fileId: z.number() }))
      .query(async ({ input }) => {
        return await listScreenshots(input.fileId);
      }),
  }),
});

export type AppRouter = typeof appRouter;

