import { buildNavigationHref, resolveAppPathname } from "../../src/app/router.js";
import { test } from "../testHarness.js";

test("router resolves home route from packaged file URL", () => {
  const pathname = resolveAppPathname({
    protocol: "file:",
    pathname: "/C:/Users/Liza/vkr/twin-desktop/apps/desktop/dist/index.html",
    search: "",
  });

  if (pathname !== "/") {
    throw new Error(`Expected packaged desktop home route to resolve to "/", got "${pathname}".`);
  }
});

test("router resolves desktop route from file URL search param", () => {
  const pathname = resolveAppPathname({
    protocol: "file:",
    pathname: "/C:/Users/Liza/vkr/twin-desktop/apps/desktop/dist/index.html",
    search: "?route=%2Fmodel&view=2d",
  });

  if (pathname !== "/model") {
    throw new Error(`Expected packaged desktop route to resolve to "/model", got "${pathname}".`);
  }
});

test("router keeps index.html and stores route in search for file navigation", () => {
  const nextHref = buildNavigationHref(
    "file:///C:/Users/Liza/vkr/twin-desktop/apps/desktop/dist/index.html",
    "/results"
  );
  const nextUrl = new URL(nextHref);

  if (nextUrl.pathname !== "/C:/Users/Liza/vkr/twin-desktop/apps/desktop/dist/index.html") {
    throw new Error(`Desktop navigation must keep index.html pathname, got "${nextUrl.pathname}".`);
  }
  if (nextUrl.searchParams.get("route") !== "/results") {
    throw new Error(`Desktop navigation must persist route=/results, got "${nextUrl.searchParams.get("route")}".`);
  }
});

test("router preserves formula anchors in desktop file navigation", () => {
  const nextHref = buildNavigationHref(
    "file:///C:/Users/Liza/vkr/twin-desktop/apps/desktop/dist/index.html?route=%2Fmodel",
    "/formulas#formula-heat_loss"
  );
  const nextUrl = new URL(nextHref);

  if (nextUrl.searchParams.get("route") !== "/formulas") {
    throw new Error(`Expected formulas route, got "${nextUrl.searchParams.get("route")}".`);
  }
  if (nextUrl.hash !== "#formula-heat_loss") {
    throw new Error(`Expected formula hash anchor to be preserved, got "${nextUrl.hash}".`);
  }
});
