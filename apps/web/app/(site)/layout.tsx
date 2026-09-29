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
    <div className="flex min-h-screen bg-shell-bg text-[14px] text-ink">
      <GlobalSidebar />
      <div className="my-3 mr-3 flex min-h-[calc(100vh-24px)] min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] bg-white shadow-card">
        <div className="flex-1">{children}</div>
        <GlobalFooter />
      </div>
    </div>
  );
}
