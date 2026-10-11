import { loadBoard, paginateBoard } from "./data";
import { BoardView } from "./view";

export const dynamic = "force-dynamic";

export default async function BoardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : undefined;
  const query = {
    q: value("q"), session: value("session"), interruption: value("interruption"), page: Number(value("page") ?? 1),
  };
  return <BoardView initial={paginateBoard(await loadBoard(), query)} initialQuery={query} />;
}
