import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifySimpleToken } from "../simple-auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const authHeader = opts.req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const result = verifySimpleToken(token);
    if (result.valid) {
      user = result.user;
      console.log("DEBUG: Usuário autenticado via Authorization header:", user.email);
    } else {
      console.log("DEBUG: Token inválido do Authorization header.");
    }
  }

  try {
    // user = await sdk.authenticateRequest(opts.req); // Comentado pois estamos usando autenticação simples
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

