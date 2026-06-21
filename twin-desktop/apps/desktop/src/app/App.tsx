import { NotificationPanel, SourceBadgeIconFilters } from "../shared/ui";
import { usePathname } from "./router";
import { resolveRoute } from "./routes";
import TopBar from "./TopBar";
import DebugConsole from "../features/debug/DebugConsole";
import FormulaDrawer from "../features/formulas/FormulaDrawer";
import ReportExportListener from "../features/reports/exports/ReportExportListener";
import ProjectStateBridge from "./ProjectStateBridge";

export default function App() {
  const pathname = usePathname();
  const route = resolveRoute(pathname);
  const Active = route.component;
  const isBuildRoute = pathname === "/build";
  const isHomeRoute = pathname === "/";

  return (
    <div
      className={
        isBuildRoute
          ? "flex h-screen flex-col overflow-hidden bg-[color:var(--app-bg)] text-[color:var(--text-base)]"
          : isHomeRoute
            ? "ui-page-home min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-base)]"
            : "min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-base)]"
      }
    >
      <SourceBadgeIconFilters />
      <ProjectStateBridge />
      <TopBar currentPath={pathname} />
      <main
        className={
          isBuildRoute
            ? "ui-page-enter mx-auto flex w-full max-w-[min(100%,100rem)] flex-1 min-h-0 overflow-hidden px-4 pb-3 pt-3 sm:px-6 xl:px-10"
            : isHomeRoute
              ? "ui-page-enter mx-auto w-full px-4 pb-20 pt-2 sm:px-6 xl:px-10"
              : "ui-page-enter mx-auto w-full max-w-[min(100%,100rem)] px-4 pb-20 pt-3 sm:px-6 xl:px-10"
        }
      >
        <Active />
      </main>
      <NotificationPanel />
      <FormulaDrawer />
      <DebugConsole />
      <ReportExportListener />
    </div>
  );
}
