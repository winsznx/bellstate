import { GlobalFooter } from "../_components/GlobalFooter";
import { GlobalHeader } from "../_components/GlobalHeader";

/** PRD §11.2 G1/G2. Applies to every screen except /embed/[symbol] (§17: the embed is a bare
 * iframe widget with no nav) — kept out of this route group for exactly that reason. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <GlobalHeader />
      <div className="flex-1">{children}</div>
      <GlobalFooter />
    </div>
  );
}
