import { loadBoard } from "./data";
import { BoardView } from "./view";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  return <BoardView initial={await loadBoard()} />;
}
