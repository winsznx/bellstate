import { NextResponse } from "next/server";
import { loadBoard } from "../data";

export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(await loadBoard(), {
    headers: { "Cache-Control": "no-store" },
  });
}
