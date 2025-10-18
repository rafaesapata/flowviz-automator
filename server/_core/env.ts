import { z } from 'zod';

const envSchema = z.object({
  VITE_APP_ID: z.string().min(1, { message: "VITE_APP_ID é obrigatório" }),
  VITE_OAUTH_PORTAL_URL: z.string().url({ message: "VITE_OAUTH_PORTAL_URL deve ser uma URL válida" }),
  VITE_APP_TITLE: z.string().min(1, { message: "VITE_APP_TITLE é obrigatório" }),
  VITE_APP_LOGO: z.string().url({ message: "VITE_APP_LOGO deve ser uma URL válida" }).optional(),
  VITE_ANALYTICS_ENDPOINT: z.string().url({ message: "VITE_ANALYTICS_ENDPOINT deve ser uma URL válida" }).optional(),
  VITE_ANALYTICS_WEBSITE_ID: z.string().optional(),
  OAUTH_SERVER_URL: z.string().url({ message: "OAUTH_SERVER_URL é obrigatório e deve ser uma URL válida" }),
  DATABASE_URL: z.string().min(1, { message: "DATABASE_URL é obrigatório" }),
  JWT_SECRET: z.string().min(32, { message: "JWT_SECRET deve ter pelo menos 32 caracteres" }),
  OPENAI_API_URL: z.string().url({ message: "OPENAI_API_URL deve ser uma URL válida" }).optional(),
  OPENAI_API_KEY: z.string().optional(),
  PORT: z.string().default('3000').transform(Number).optional(),
  OWNER_OPEN_ID: z.string().optional(),
  BUILT_IN_FORGE_API_URL: z.string().url({ message: "BUILT_IN_FORGE_API_URL deve ser uma URL válida" }).optional(),
  BUILT_IN_FORGE_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

type EnvSchema = z.infer<typeof envSchema>;

try {
  envSchema.parse(process.env);
} catch (error) {
  console.error('Erro de validação de variáveis de ambiente:', error);
  process.exit(1);
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvSchema {}
  }
}

export const ENV = {
  appId: process.env.VITE_APP_ID,
  cookieSecret: process.env.JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  oAuthServerUrl: process.env.OAUTH_SERVER_URL,
  ownerId: process.env.OWNER_OPEN_ID,
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL,
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY,
};

