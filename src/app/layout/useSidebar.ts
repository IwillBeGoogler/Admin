import { useStoredState } from "@/shared/lib/useStoredState";

const states = ["expanded", "collapsed"] as const;

/** Desktop sidebar width, persisted in localStorage["admin.sidebar"]. */
export function useSidebar() {
  const [state, setState] = useStoredState("admin.sidebar", "expanded", states);
  const collapsed = state === "collapsed";
  return { collapsed, toggle: () => setState(collapsed ? "expanded" : "collapsed") };
}
