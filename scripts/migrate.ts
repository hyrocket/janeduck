import { readFileSync } from "fs"
import { join } from "path"
import { neon } from "@neondatabase/serverless"
import * as dotenv from "dotenv"

dotenv.config({ path: join(process.cwd(), ".env.local") })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL || DATABASE_URL.includes("user:password")) {
  console.error("❌ DATABASE_URL is not set in .env.local")
  process.exit(1)
}

const sql = neon(DATABASE_URL)
const schema = readFileSync(join(process.cwd(), "lib/db/schema.sql"), "utf-8")

async function migrate() {
  console.log("🚀 Running migration...")
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  try {
    for (const stmt of statements) {
      await sql.query(stmt)
    }
    console.log("✅ Migration complete — 5 tables created")
  } catch (err) {
    console.error("❌ Migration failed:", err)
    process.exit(1)
  }
}

migrate()
