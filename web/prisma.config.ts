import { defineConfig } from "prisma/config";
import { PrismaNeon } from "@prisma/adapter-neon";

export default defineConfig({
  migrate: {
    async adapter(env) {
      return new PrismaNeon({ connectionString: env.DATABASE_URL as string });
    },
  },
});
