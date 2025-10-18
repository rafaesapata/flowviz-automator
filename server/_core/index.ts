import "dotenv/config";
import { logger } from "./logger";
import { getDb } from "../db";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Testar conexão com o banco de dados proativamente
  logger.info("Testando conexão com o banco de dados...");
  try {
    const db = await getDb();
    if (!db) {
      throw new Error("Conexão com o banco de dados não estabelecida.");
    }
    await db.execute("SELECT 1"); // Executar uma query simples para testar a conexão
    logger.info("Conexão com o banco de dados bem-sucedida.");
  } catch (error) {
    logger.error({ error }, "Erro ao conectar ao banco de dados");
    process.exit(1); // Encerrar o processo se a conexão falhar
  }

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // Serve screenshots folder
  app.use('/screenshots', express.static(path.join(process.cwd(), 'public', 'screenshots')));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.warn(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}/`);
    
    // Iniciar scheduler de automação
    // Importar dinamicamente para evitar problemas de dependência circular e garantir que o DB esteja pronto
    import("../automation-scheduler").then(({ startScheduler }) => {
      startScheduler();
        }).catch((error) => logger.error({ error }, "Erro ao iniciar o scheduler de automação"));
  });
}

startServer().catch((error) => logger.fatal({ error }, "Erro fatal ao iniciar o servidor"));
