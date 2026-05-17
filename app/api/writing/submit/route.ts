import { NextRequest, NextResponse } from "next/server"

const PYTHON = process.env.PYTHON_API_URL ?? "http://localhost:8000"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${PYTHON}/writing/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json(
      { error: "Python server unreachable. Is uvicorn running on port 8000?" },
      { status: 503 }
    )
  }
}
