import * as React from "react";
import {promiseCache, PromiseState, reverseCache} from "./cache";
import {isServer} from "./utils";

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
function stringify(val, depth) {
  depth = isNaN(+depth) ? 1 : depth;

  function _build(key, val, depth, o?, a?) { // (JSON.stringify() has it's own rules, which we respect here by using it for property iteration)
    return !val || typeof val !== 'object' ? val : (a = Array.isArray(val), JSON.stringify(val, function (
      k, v) {
      if (a || depth > 0) {
        if (!k) return (a = Array.isArray(v), val = v);
        !o && (o = a ? [] : {});
        o[k] = _build(k, v, a ? depth : depth - 1);
      }
    }), o || (a ? [] : {}));
  }

  return JSON.stringify(_build('', val, depth));
}

function HydrationExecutor({forceInclude}: {
  forceInclude?: Record<string, true>
}) {
  if (!isServer) {
    // todo: spread hydration on effect
    return null;
  }
  let ctx = React.useContext(HydrationContext);
  let allCtx = {...ctx, ...forceInclude}
  let entries = resolveDataToBeHydrated(allCtx)
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

