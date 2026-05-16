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

function splitStatements(sqlText: string): string[] {
  const statements: string[] = []
  let current = ""
  let inDollarQuote = false
  let i = 0

  while (i < sqlText.length) {
    if (sqlText[i] === "$" && sqlText[i + 1] === "$") {
      inDollarQuote = !inDollarQuote
      current += "$$"
      i += 2
      continue
    }
    if (sqlText[i] === ";" && !inDollarQuote) {
      const stmt = current.trim()
      if (stmt) statements.push(stmt)
      current = ""
      i++
      continue
    }
    current += sqlText[i]
    i++
  }
  const remaining = current.trim()
  if (remaining) statements.push(remaining)
  return statements
}

async function migrate() {
  console.log("🚀 Running migration...")
  const statements = splitStatements(schema)

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
