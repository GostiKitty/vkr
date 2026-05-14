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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <TopBar currentPath={pathname} />
      <EngineConfigBanner />
      <main className="mx-auto max-w-6xl pb-12">
        <Active />
      </main>
      <NotificationPanel />
      <FormulaDrawer />
      <DebugConsole />
    </div>
  );
}
