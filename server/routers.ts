import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  cnab: router({
    uploadFile: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileSize: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createCnabFile, createCnabLog } = await import("./db");
        const fileId = `cnab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const file = await createCnabFile({
          id: fileId,
          fileName: input.fileName,
          fileSize: input.fileSize,
          userId: ctx.user.id,
          status: "pending",
        });
        await createCnabLog({
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          fileId,
          level: "info",
          message: `Arquivo ${input.fileName} enviado com sucesso`,
        });
        return file;
      }),
    
    listFiles: protectedProcedure.query(async ({ ctx }) => {
      const { getCnabFiles } = await import("./db");
      return getCnabFiles(ctx.user.id);
    }),
    
    getLogs: protectedProcedure
      .input(z.object({ fileId: z.string() }))
      .query(async ({ input }) => {
        const { getCnabLogs } = await import("./db");
        return getCnabLogs(input.fileId);
      }),
    
    processFile: protectedProcedure
      .input(z.object({ fileId: z.string() }))
      .mutation(async ({ input }) => {
        const { updateCnabFileStatus, createCnabLog } = await import("./db");
        await updateCnabFileStatus(input.fileId, "processing");
        await createCnabLog({
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          fileId: input.fileId,
          level: "info",
          message: "Iniciando processamento do arquivo",
        });
        // Aqui será integrado com a automação QPROF
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
