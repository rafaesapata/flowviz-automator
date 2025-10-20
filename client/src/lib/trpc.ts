import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "https://3002-iowsqrbvngsago3h2f1o6-d7a3eba7.manusvm.computer/api/trpc", // Substitua pela URL da sua API
      async headers() {
        const token = localStorage.getItem("auth_token");
        return {
          authorization: token ? `Bearer ${token}` : "",
        };
      },
    }),
  ],
});
