import * as React from "react";
import {
  AppEntry,
  Application,
  DefaultShape, ErrorState, PendingState, Token,
  SomethingIrrelevant, State, SuccessState, Api, ExtendedFn
} from "./types";

type AppContextType<T extends DefaultShape> = {
  cache: WeakMap<any, {
    calls: Map<string, State<any, any, any>>,
    listeners?: Record<number, (state: any) => void>
  }>,
  app: Application<T>,
}
const AppContext = React.createContext<AppContextType<any> | null>(null)
export let jeton: SomethingIrrelevant = {} as const

function useAppContext<T extends DefaultShape>(): Application<T> {
  let result = React.useContext(AppContext)
  if (!result) {
    throw new Error("Add <LibraryProvider />");
  }
  return result.app
}

function useCache<T extends DefaultShape>() {
  let result = React.useContext(AppContext)
  if (!result) {
    throw new Error("Add <LibraryProvider />");
  }
  return result.cache
}

export function useApp<T extends DefaultShape>(): Application<T> {
  return useAppContext<T>()
}

export function createApp<Shape extends DefaultShape>(shape: AppEntry<Shape>) {
  return {
    Provider({children}: { children: React.ReactNode }) {
      let self = React.useMemo(() => {
        let cache = new WeakMap()
        return {
          cache,
          app: createAppForShape(shape, cache),
        }
      }, [shape])

      return (
        <AppContext.Provider value={self}>
          {children}
        </AppContext.Provider>
      )
    },
    useApp(): Application<Shape> {
      return useAppContext()
    }
  }
}

export function useApi<T, R, A extends unknown[]>(
  create: (...args: A) => (T | Promise<T>),
  deps = []
) {
  let cache = useCache();
  return React.useMemo(() => {
    let token = createToken<T, R, A>(undefined, cache)
    token.inject(create)
    return token;
  }, deps)
}

function createAppForShape(
  shape: Record<string, Record<string, any>>,
  cache: WeakMap<any, {
    calls: Map<string, any>,
    listeners?: Record<number, () => void>
  }>,
) {
  const app = {}

  for (let [resourceName, resource] of Object.entries(shape)) {
    let currentResource = {}
    for (let [apiName, apiDefinition] of Object.entries(resource)) {
      currentResource[apiName] = createToken(apiDefinition, cache)
    }
    app[resourceName] = currentResource;
  }

  return app;
}

function createToken<T, R, A extends unknown[]>(
  apiDefinition: Api<T, R, A> | undefined,
  cache: WeakMap<any, {
    calls: Map<string, State<T, R, A>>,
    listeners?: Record<number, (state: any) => void>
  }>,
): Token<T, R, A> {
  let index = 0
  let realFunction

  if (apiDefinition && apiDefinition.producer) {
    realFunction = apiDefinition.producer
  }


  function token(): Promise<T> | State<T, R, A> {
    if (!realFunction) {
      throw new Error(`inject your function first`) // todo: add full path
    }
    if (!cache.has(realFunction)) {
      cache.set(realFunction, {calls: new Map()})
    }

    let memoizedArgs = memoize(arguments)
    let functionCache = cache.get(realFunction)!.calls

    // existing
    if (functionCache.has(memoizedArgs)) {
      let cacheData = functionCache.get(memoizedArgs)!
      // either with a promise or sync value
      return cacheData.promise ? cacheData.promise : cacheData;
    }
    let argsCopy = Array.from(arguments);
    let dataToCache = realFunction.apply(null, arguments)

    if (dataToCache && typeof dataToCache.then === "function") {
      trackPromiseResult(memoizedArgs, argsCopy, dataToCache, functionCache)
    } else {
      // sync, no promise involved, mostly useReducer or useState
      functionCache.set(memoizedArgs, {
        args: argsCopy,
        data: dataToCache,
        status: "fulfilled",
      } as SuccessState<T, A>)
    }
    let cacheData = functionCache.get(memoizedArgs)!
    return cacheData.promise ? cacheData.promise : cacheData;
  }

  token.evict = function evict() {
    let fnCache = cache.get(realFunction)! // todo: throw
    let cacheCalls = fnCache.calls
    let memoizedArgs = memoize(arguments)
    if (cacheCalls.has(memoizedArgs)) {
      let result = cacheCalls.delete(memoizedArgs)!;
      if (fnCache.listeners) {
        React.startTransition(() => {
          Object.values(fnCache.listeners!).forEach((cb) => cb({}))
        })
      }
      return result
    }
  };

  token.inject = function inject(fn) {
    realFunction = fn;
  };

  token.subscribe = function subscribe(cb) {
    let id = ++index
    let fnCache = cache.get(realFunction)!
    if (!fnCache.listeners) {
      fnCache.listeners = {}
    }
    fnCache.listeners[id] = cb
    return () => delete fnCache.listeners![id]
  };

  return token as Token<T, R, A>;
}

function trackPromiseResult<T, R, A extends unknown[]>(
  memoizedArgs, argsCopy, dataToCache, fnCache) {
  fnCache.set(memoizedArgs, {
    args: argsCopy,
    data: dataToCache,
    status: "pending",
    promise: dataToCache,
  } as PendingState<T, A>)
  dataToCache.then(
    result => {
      fnCache.set(memoizedArgs, {
        data: result,
        args: argsCopy,
        status: "fulfilled",
        promise: dataToCache,
      } as SuccessState<T, A>)
    },
    reason => {
      fnCache.set(memoizedArgs, {
        data: reason,
        args: argsCopy,
        status: "rejected",
        promise: dataToCache,
      } as ErrorState<T, R, A>)
    },
  );
}

function memoize(args) {
  return JSON.stringify(args) // todo: do it right!
}

let defaultJT = {fn: jeton}

function buildDefaultJT<T, R, A extends unknown[]>(): {
  fn: ExtendedFn<T, R, A>
} {
  return defaultJT as { fn: ExtendedFn<T, R, A> }
}

export function api<T, R, A extends unknown[]>(
  props?: Omit<Api<T, R, A>, "fn">
): Api<T, R, A> {
  return Object.assign({}, props, buildDefaultJT<T, R, A>())
}
