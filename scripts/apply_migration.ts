import { neon } from "@neondatabase/serverless"
import { readFileSync } from "fs"
import { join } from "path"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL || DATABASE_URL.includes("user:password")) {
  console.error("❌ DATABASE_URL not set in .env.local")
  process.exit(1)
}

const migrationFile = process.argv[2]
if (!migrationFile) {
  console.error("Usage: npx tsx scripts/apply_migration.ts <migration-file>")
  console.error("Example: npx tsx scripts/apply_migration.ts lib/db/migrations/001_update_schema.sql")
  process.exit(1)
}

const sql = neon(DATABASE_URL)
const migrationSql = readFileSync(join(process.cwd(), migrationFile), "utf-8")

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

async function applyMigration() {
  console.log(`🚀 Applying migration: ${migrationFile}`)
  const statements = splitStatements(migrationSql)
    .map(s => s.split("\n").filter(line => !line.trim().startsWith("--")).join("\n").trim())
    .filter(s => s.length > 0)

  let applied = 0
  let skipped = 0

  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80)
    try {
      await sql.query(stmt)
      console.log(`  ✅ ${preview}`)
      applied++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (
        msg.includes("already exists") ||
        msg.includes("does not exist") ||
        msg.includes("duplicate column")
      ) {
        console.log(`  ⏭  ${preview} (skipped: ${msg.split("\n")[0]})`)
        skipped++
      } else {
        console.error(`  ❌ ${preview}`)
        console.error(`     ${msg}`)
        process.exit(1)
      }
    }
  }

  console.log(`\n✅ Migration complete — ${applied} applied, ${skipped} skipped`)
}

applyMigration()
