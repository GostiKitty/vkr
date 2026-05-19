import { NotificationPanel } from "../shared/ui";
import { usePathname } from "./router";
import { resolveRoute } from "./routes";
import TopBar from "./TopBar";
import DebugConsole from "../features/debug/DebugConsole";
import FormulaDrawer from "../features/formulas/FormulaDrawer";
import EngineConfigBanner from "./EngineConfigBanner";

export default function App() {
  const pathname = usePathname();
  const route = resolveRoute(pathname);
  const Active = route.component;
  const isBuildRoute = pathname === "/build";

  return (
    <div
      className={
        isBuildRoute
          ? "flex h-screen flex-col overflow-hidden bg-[color:var(--app-bg)] text-[color:var(--text-base)]"
          : "min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-base)]"
      }
    >
      <TopBar currentPath={pathname} />
      <EngineConfigBanner />
      <main
        className={
          isBuildRoute
            ? "ui-page-enter mx-auto flex w-full max-w-[min(100%,96rem)] flex-1 min-h-0 overflow-hidden px-4 pb-3 pt-3 sm:px-6 xl:px-8"
            : "ui-page-enter mx-auto w-full max-w-[min(100%,96rem)] px-4 pb-20 pt-3 sm:px-6 xl:px-8"
        }
      >
        <Active />
      </main>
      <NotificationPanel />
      <FormulaDrawer />
      <DebugConsole />
    </div>
  );
}
