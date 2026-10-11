import { GlobalFooter } from "../_components/GlobalFooter";
import { GlobalSidebar } from "../_components/GlobalSidebar";

/**
 * PRD §11.2 G1/G2. Applies to every screen except /embed/[symbol] (§17: the embed is a bare
 * iframe widget with no nav) — kept out of this route group for exactly that reason.
 *
 * Structure matches the real product shell this project's owner pointed at: a gray outer shell
 * (`bg-shell-bg`, #eceef1) with a white, rounded, softly-shadowed content panel inset from it —
 * not a flat single-background page. Verified against that product's actual `product.css`
 * (`.product-shell` / `.product-workspace`), not its design-system markdown.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-shell-bg text-[14px] text-ink md:flex-row">
      <GlobalSidebar />
      <div className="flex min-h-[calc(100vh-64px)] min-w-0 flex-1 flex-col overflow-hidden bg-white md:my-3 md:mr-3 md:min-h-[calc(100vh-24px)] md:rounded-[22px] md:shadow-card">
        <div className="flex-1">{children}</div>
        <GlobalFooter />
      </div>
    </div>
  );
}
