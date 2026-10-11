import { NextResponse } from "next/server";
import { loadBoard, paginateBoard } from "../data";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.json(paginateBoard(await loadBoard(), {
    q: url.searchParams.get("q") ?? undefined,
    session: url.searchParams.get("session") ?? undefined,
    interruption: url.searchParams.get("interruption") ?? undefined,
    page: Number(url.searchParams.get("page") ?? 1),
  }), {
    headers: { "Cache-Control": "no-store" },
  });
}
