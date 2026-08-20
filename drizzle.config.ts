import { defineConfig } from "drizzle-kit";

if (!process.env.NEON_SHARED_DATABASE_URL) {
  throw new Error("NEON_SHARED_DATABASE_URL is required");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEON_SHARED_DATABASE_URL,
  },
});
