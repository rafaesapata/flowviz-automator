import { logger } from "./_core/logger";

export const QPROF_CONFIG = {
  baseUrl: process.env.QPROF_BASE_URL || "https://qprof.flowinvest.capital",
  credentials: {
    username: process.env.QPROF_USERNAME || "",
    password: process.env.QPROF_PASSWORD || ""
  },
  get billingUrl() {
    return `${this.baseUrl}/Billing/FCO001.aspx`;
  }
};

logger.info(`QPROF_CONFIG.baseUrl carregado: ${QPROF_CONFIG.baseUrl}`);
logger.info(`QPROF_CONFIG.credentials.username carregado: ${QPROF_CONFIG.credentials.username ? "SIM" : "NÃO"}`);
logger.info(`QPROF_CONFIG.credentials.password carregado: ${QPROF_CONFIG.credentials.password ? "SIM" : "NÃO"}`);

