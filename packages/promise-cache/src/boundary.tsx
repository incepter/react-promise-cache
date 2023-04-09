import * as React from "react";
import {promiseCache, PromiseState, reverseCache} from "./cache";
import {isServer, stringify} from "./utils";

export let HydrationContext = React.createContext<Record<string, true>>({})

export function Boundary({fallback, children, forceInclude}: {
  children,
  fallback?,
  forceInclude?: Record<string, true>
}) {
  let entriesToHydrateInThisBoundary = React.useRef<Record<string, true>>()
  if (!entriesToHydrateInThisBoundary.current) {
    entriesToHydrateInThisBoundary.current = {}
  }
  return (
    <React.Suspense fallback={fallback}>
      <HydrationContext.Provider value={entriesToHydrateInThisBoundary.current}>
        {children}
        <HydrationExecutor forceInclude={forceInclude}/>
      </HydrationContext.Provider>
    </React.Suspense>
  );
}
function HydrationExecutor({forceInclude}: {
  forceInclude?: Record<string, true>
}) {
  if (!isServer) {
    // todo: spread hydration on effect
    return null;
  }
  let ctx = React.useContext(HydrationContext);
  let entriesToHydrate = {...ctx, ...forceInclude}
  let entries = resolveDataToBeHydrated(entriesToHydrate)
  let assignment = `Object.assign(window.__HYDRATED_PROMISE_CACHE__ || {}, ${stringify(entries, 5)})`
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__HYDRATED_PROMISE_CACHE__ = ${assignment}`
      }}></script>
  )
}

function getPromiseState<T, E>(arg: string): PromiseState<T, E> | undefined {
  let promise = promiseCache.get(arg)
  return promise && reverseCache.get(promise)?.state || undefined
}

function resolveDataToBeHydrated(ctx: Record<string, true>) {
  return Object.keys(ctx).reduce((result, current) => {
    let promiseState = getPromiseState(current);
    if (promiseState) {
      result[current] = promiseState
    }
    return result;
  }, {})
}

