import * as React from "react";
import {Suspense} from "react";
import {
  Api,
  ApiEntry,
  AppContextType,
  AppEntry,
  Application,
  DefaultShape,
  ErrorState,
  ExtendedFn,
  PendingState,
  ProviderProps,
  State,
  SuccessState,
} from "./types";
import {isServer, maybeWindow, stringify} from "./utils";
import {useImpl} from "./useImpl";

const AppContext = React.createContext<AppContextType<any> | null>(null)

function useAppContext<T extends DefaultShape>(): AppContextType<T> {
  let result = React.useContext(AppContext)
  if (!result) {
    throw new Error("Add <AppProvider /> up in your tree");
  }
  return result
}

export function useCache<T extends DefaultShape>() {
  return useAppContext().cache
}

export function useApp<T extends DefaultShape>(): Application<T> {
  return useAppContext<T>().app
}

export function AppProvider<T extends DefaultShape>(
  {children, shape, cache, app}: ProviderProps<T>
) {
  let self = React.useMemo(() => {
    if (app) {
      if (!cache) {
        throw new Error('Cannot pass app without its cache');
      }
      return {
        app,
        cache,
      }
    }
    let cacheToUse = cache || new Map();
    let appToUse = createAppForShape(cacheToUse, shape) as Application<T>

    return {
      app: appToUse,
      cache: cacheToUse,
    }
  }, [app, shape, cache])

  return (
    <AppContext.Provider value={self}>
      {children}
    </AppContext.Provider>
  )
}

export function createApp<Shape extends DefaultShape>(
  shape: AppEntry<Shape>,
  cache?: Map<string, {
    name: string,
    calls: Map<string, any>,
    listeners?: Record<number, () => void>
  }>,
) {
  let cacheToUse = cache || new Map();
  let app = createAppForShape(cacheToUse, shape) as Application<Shape>
  return {
    app,
    Provider({children}: ProviderProps<Shape>) {
      return (
        <AppProvider cache={cacheToUse} app={app} shape={shape}>
          {children}
        </AppProvider>
      )
    },
    useApp(): Application<Shape> {
      return useAppContext<Shape>().app
    }
  }
}

export function useApi<T, R, A extends unknown[]>(
  create: (...args: A) => (T | Promise<T>),
  deps = [],
  name = create.name
) {
  let cache = useCache();
  return React.useMemo(() => {
    let token = createApi<T, R, A>(undefined, cache, name)
    token.inject(create)
    return token;
  }, deps)
}

function createAppForShape(
  cache: Map<any, {
    name: string,
    calls: Map<string, any>,
    listeners?: Record<number, () => void>
  }>,
  shape?: Record<string, Record<string, any>>,
) {
  const app = {}
  if (!shape) {
    return app;
  }
  for (let [resourceName, resource] of Object.entries(shape)) {
    let currentResource = {}
    for (let [apiName, apiDefinition] of Object.entries(resource)) {
      let name = `${resourceName}_${apiName}`
      currentResource[apiName] = createApi(apiDefinition, cache, name)
    }
    app[resourceName] = currentResource;
  }

  return app;
}

export function createApi<T, R, A extends unknown[]>(
  apiDefinition: ApiEntry<T, R, A> | undefined,
  cache: Map<any, {
    name: string,
    calls: Map<string, State<T, R, A>>,
    listeners?: Record<number, (state: any) => void>
  }>,
  name: string,
): Api<T, R, A> {
  let index = 0
  let realFunction

  if (apiDefinition && apiDefinition.producer) {
    realFunction = apiDefinition.producer
  }

  function apiToken(...args: A): Promise<T> | State<T, R, A> {
    if (!realFunction) {
      throw new Error(`inject your ${name} function first`)
    }
    if (!cache.has(realFunction)) {
      let cacheToUse;
      if (!isServer) {
        let hydratedCache = attemptHydratedCacheForApi(name)
        if (hydratedCache) {
          cacheToUse = hydratedCache;
        }
      }
      if (!cacheToUse) {
        cacheToUse = new Map()
      }
      cache.set(realFunction, {name, calls: cacheToUse})
    }

    let memoizedArgs = memoize(args)
    let functionCache = cache.get(realFunction)!.calls


    // existing
    if (functionCache.has(memoizedArgs)) {
      let cacheData = functionCache.get(memoizedArgs)!
      // either with a promise or sync value
      return cacheData.promise ? cacheData.promise : cacheData;
    }
    let argsCopy = Array.from(args);
    let dataToCache = realFunction.apply(null, args)

    if (dataToCache && typeof dataToCache.then === "function") {
      trackPromiseResult(memoizedArgs, argsCopy, dataToCache, cache.get(realFunction)!)
    } else {
      // sync, no promise involved, mostly useReducer or useState
      functionCache.set(memoizedArgs, {
        args: argsCopy,
        data: dataToCache,
        status: "fulfilled",
      } as SuccessState<T, A>)
      notifyListeners(cache.get(realFunction)!.listeners);
    }
    let cacheData = functionCache.get(memoizedArgs)!
    return cacheData.promise ? cacheData.promise : cacheData;
  }

  apiToken.evict = function evict(...args: A) {
    let fnCache = cache.get(realFunction)! // todo: throw
    let cacheCalls = fnCache.calls
    let memoizedArgs = memoize(args)
    if (cacheCalls.has(memoizedArgs)) {
      cacheCalls.delete(memoizedArgs);
      if (fnCache.listeners) {
        React.startTransition(() => {
          Object.values(fnCache.listeners!).forEach((cb) => cb({}))
        })
      }
    }
    return apiToken;
  };

  apiToken.use = function use(...args: A) {
    return useImpl(apiToken.apply(null, args))
  };

  apiToken.useState = function useState(...args: A) {
    apiToken.apply(null, args);

    let memoizedArgs = memoize(args);
    let functionCache = cache.get(realFunction)!.calls;

    let rerender = React.useState()[1];
    React.useEffect(() => apiToken.subscribe(rerender), []);

    return functionCache.get(memoizedArgs)!
  };

  apiToken.inject = function inject(fn) {
    realFunction = fn;
    return apiToken;
  };

  apiToken.subscribe = function subscribe(cb) {
    let id = ++index
    let fnCache = cache.get(realFunction)!
    if (!fnCache.listeners) {
      fnCache.listeners = {}
    }
    fnCache.listeners[id] = cb
    return () => {
      delete fnCache.listeners![id]
    }
  };

  return apiToken as Api<T, R, A>;
}

function notifyListeners(listeners?: Record<number, ({}) => void>) {
  if (listeners) {
    React.startTransition(() => {
      Object.values(listeners!).forEach((cb) => cb({}))
    })
  }
}

function trackPromiseResult<T, R, A extends unknown[]>(
  memoizedArgs: string,
  argsCopy: A,
  dataToCache: Promise<T>,
  fnCache: {
    name: string,
    calls: Map<string, State<T, R, A>>,
    listeners?: Record<number, (state: any) => void>
  },
) {
  let callsCache = fnCache.calls;
  callsCache.set(memoizedArgs, {
    args: argsCopy,
    data: dataToCache,
    status: "pending",
    promise: dataToCache,
  } as PendingState<T, A>);
  notifyListeners(fnCache.listeners);

  dataToCache.then(
    result => {
      callsCache.set(memoizedArgs, {
        data: result,
        args: argsCopy,
        status: "fulfilled",
        promise: dataToCache,
      } as SuccessState<T, A>);
      notifyListeners(fnCache.listeners);
      return result;
    },
    reason => {
      callsCache.set(memoizedArgs, {
        data: reason,
        args: argsCopy,
        status: "rejected",
        promise: dataToCache,
      } as ErrorState<T, R, A>);
      notifyListeners(fnCache.listeners);
      return reason;
    },
  );
}

function memoize(args) {
  return JSON.stringify(args) // todo: do it right!
}

let defaultJT = {fn: {}}

function buildDefaultJT<T, R, A extends unknown[]>(): {
  fn: ExtendedFn<T, R, A>
} {
  return defaultJT as { fn: ExtendedFn<T, R, A> }
}

export function api<T, R, A extends unknown[]>(
  props?: Omit<ApiEntry<T, R, A>, "fn">
): ApiEntry<T, R, A> {
  return Object.assign({}, props, buildDefaultJT<T, R, A>())
}

export function SuspenseBoundary({fallback, children, id}: {
  id: string,
  fallback?: React.ReactNode,
  children?: React.ReactNode,
}) {
  return (
    <Suspense fallback={fallback}>
      {children}
      <Hydration id={id}/>
    </Suspense>
  )
}

export function Hydration({id}: { id: string }) {
  if (!id) {
    throw new Error("Please give a unique id to Hydration!")
  }
  if (!isServer) {
    // todo: spread hydration states, streaming may alter the previous values
    let existingHtml = React.useRef<string | undefined>()
    if (!existingHtml.current) {
      existingHtml.current = document
        .getElementById(id)?.innerHTML
    }
    return existingHtml.current ? (
      <script
        id={id}
        dangerouslySetInnerHTML={{
          __html: existingHtml.current
        }}></script>
    ) : null;
  }
  let cache = useCache();

  let entries: Record<string, Record<string, State<any, any, any>>> = {}
  for (let {name, calls} of cache.values()) {
    entries[name] = transformForHydratedCallsCache(calls)
  }

  let assignment = `Object.assign(window.__HYDRATED_APP_CACHE__ || {}, ${stringify(entries, 5)})`
  return (
    <script
      id={id}
      dangerouslySetInnerHTML={{
        __html: `window.__HYDRATED_APP_CACHE__ = ${assignment}`
      }}></script>
  )
}

function transformForHydratedCallsCache(
  calls: Map<string, State<any, any, any>>
) {
  return [...calls.entries()].reduce((acc, curr) => {
    if (curr[1].hydrated) {
      return acc;
    }
    let {promise, ...rest} = curr[1]
    curr[1].hydrated = true
    acc[curr[0]] = rest;
    return acc;
  }, {})
}

function attemptHydratedCacheForApi(name: string): Map<string, State<any, any, any>> | undefined {
  let hydratedCache = maybeWindow!.__HYDRATED_APP_CACHE__;
  if (hydratedCache && hydratedCache[name]) {
    let cache = new Map();
    for (let [argsHash, state] of Object.entries(hydratedCache[name])) {
      if (state.status === "fulfilled") {
        let promise = Promise.resolve(state.data);
        // hack react use..
        // @ts-ignore
        promise.status = "fulfilled";
        // @ts-ignore
        promise.value = state.data;
        state.promise = promise
      }
      if (state.status === "rejected") {
        // hack react use..
        let promise = Promise.resolve(state.data);
        // @ts-ignore
        promise.status = "rejected";
        // @ts-ignore
        promise.reason = state.data;
        state.promise = Promise.reject(state.data)
      }
      cache.set(argsHash, state)
    }
    return cache;
  }
}
