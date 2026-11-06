import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: { url: url ?? "postgres://localhost:5432/virtual_company" },
  strict: true,
  verbose: true,
});
