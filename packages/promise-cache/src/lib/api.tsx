import * as React from "react";
import {
  Api,
  ApiEntry, ApiOptions,
  ErrorState,
  InternalApiCacheType, InternalApiCacheValue,
  PendingState,
  Producer,
  State,
  SuccessState,
} from "../types";
import {isServer, maybeWindow} from "../utils";
import {useImpl} from "../useImpl";
import {useCache} from "./context";


export function useApi<T, R, A extends unknown[]>(
  create: (...args: A) => T | Promise<T>,
  options?: ApiOptions<T, R, A>,
) {
  let cache = useCache<T, R, A>();
  return createApi<T, R, A>(create, cache, options);
}

export function createApi<T, R, A extends unknown[]>(
  apiDefinition: ApiEntry<T, R, A> | Producer<T, A> | undefined,
  cache: InternalApiCacheType<T, R, A>,
  optionsFromOutside?: ApiOptions<T, R, A>,
): Api<T, R, A> {
  let index = 0;
  let realFunction;
  let options = optionsFromOutside;
  let name = options && options.name;

  if (apiDefinition) {
    if (typeof apiDefinition === "function") {
      realFunction = apiDefinition;
      name = options && options.name || realFunction.name;
      if (cache.has(realFunction)) {
        return cache.get(realFunction)!.api;
      }
    } else if (apiDefinition.producer) {
      realFunction = apiDefinition.producer;
      name = options && options.name || realFunction.name;
      if (cache.has(realFunction)) {
        return cache.get(realFunction)!.api;
      }
    }
  }

  function forceReloadCache() {
    let cacheToUse: Map<string, State<T, R, A>> | undefined;
    if (!isServer) {
      let hydratedCache = attemptHydratedCacheForApi(name!);
      if (hydratedCache) {
        cacheToUse = hydratedCache;
      }
    }
    if (!cacheToUse) {
      cacheToUse = new Map();
    }
    let existingEntry = cache.get(realFunction);
    // todo: reconcile with previous cache !
    let cacheEntry: InternalApiCacheValue<T, R, A>;
    if (existingEntry) {
      cacheEntry = existingEntry;
      // spread new cache
      for (let [newKey, newState] of cacheToUse.entries()) {
        cacheEntry.calls.set(newKey, newState);
      }
    } else {
      cacheEntry = {
        name: name!,
        api: apiToken,
        calls: cacheToUse,
        reload: forceReloadCache,
        notify() {
          notifyListeners(cacheEntry.listeners);
        },
      };
    }

    cache.set(realFunction, cacheEntry);
  }

  function ensureFunctionIsCached() {
    if (!cache.has(realFunction)) {
      forceReloadCache();
    }
  }

  function apiToken(...args: A): Promise<T> | State<T, R, A> {
    if (!realFunction) {
      throw new Error(`inject your ${name} function first`);
    }
    ensureFunctionIsCached();
    let memoizedArgs = memoize(args);
    let functionCache = cache.get(realFunction)!.calls;


    // existing
    if (functionCache.has(memoizedArgs)) {
      let cacheData = functionCache.get(memoizedArgs)!;
      // either with a promise or sync value
      return cacheData.promise ? cacheData.promise : cacheData;
    }
    let argsCopy = Array.from(args);
    let dataToCache = realFunction.apply(null, args);

    if (dataToCache && typeof dataToCache.then === "function") {
      trackPromiseResult(
        memoizedArgs,
        argsCopy,
        dataToCache,
        cache.get(realFunction)!
      );
    } else {
      // sync, no promise involved, mostly useReducer or useState
      functionCache.set(memoizedArgs, {
        args: argsCopy,
        data: dataToCache,
        status: "fulfilled",
      } as SuccessState<T, A>);
      notifyListeners(cache.get(realFunction)!.listeners);
    }
    let cacheData = functionCache.get(memoizedArgs)!;
    return cacheData.promise ? cacheData.promise : cacheData;
  }

  apiToken.evict = function evict(...args: A) {
    let fnCache = cache.get(realFunction)!; // todo: throw
    let cacheCalls = fnCache.calls;
    let memoizedArgs = memoize(args);
    if (cacheCalls.has(memoizedArgs)) {
      cacheCalls.delete(memoizedArgs);
      if (fnCache.listeners) {
        React.startTransition(() => {
          Object.values(fnCache.listeners!).forEach((cb) => cb({}));
        });
      }
    }
    return apiToken;
  };

  apiToken.use = function use(...args: A) {
    return useImpl(apiToken.apply(null, args));
  };

  apiToken.useState = function useState(...args: A) {
    apiToken.apply(null, args);

    let memoizedArgs = memoize(args);
    let functionCache = cache.get(realFunction)!.calls;

    let rerender = React.useState()[1];
    React.useEffect(() => apiToken.subscribe(rerender), []);

    return functionCache.get(memoizedArgs)!;
  };

  apiToken.getState = function useState(...args: A) {
    apiToken.apply(null, args);

    let memoizedArgs = memoize(args);
    return cache.get(realFunction)!.calls.get(memoizedArgs)!;
  };

  apiToken.inject = function inject(fn, opts?: ApiOptions<T, R, A>) {
    options = opts;
    realFunction = fn;
    name = options && options.name || realFunction.name;
    ensureFunctionIsCached();
    return apiToken;
  };

  apiToken.subscribe = function subscribe(cb) {
    let id = ++index;
    let fnCache = cache.get(realFunction)!;
    if (!fnCache.listeners) {
      fnCache.listeners = {};
    }
    fnCache.listeners[id] = cb;
    return () => {
      delete fnCache.listeners![id];
    };
  };

  return apiToken as Api<T, R, A>;
}

function notifyListeners(listeners?: Record<number, ({}) => void>) {
  if (listeners) {
    React.startTransition(() => {
      Object.values(listeners).forEach((cb) => cb({}));
    });
  }
}

function trackPromiseResult<T, R, A extends unknown[]>(
  memoizedArgs: string,
  argsCopy: A,
  dataToCache: Promise<T>,
  fnCache: {
    name: string;
    calls: Map<string, State<T, R, A>>;
    listeners?: Record<number, (state: any) => void>;
  }
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
    (result) => {
      callsCache.set(memoizedArgs, {
        data: result,
        args: argsCopy,
        status: "fulfilled",
        promise: dataToCache,
      } as SuccessState<T, A>);
      notifyListeners(fnCache.listeners);
      return result;
    },
    (reason) => {
      callsCache.set(memoizedArgs, {
        data: reason,
        args: argsCopy,
        status: "rejected",
        promise: dataToCache,
      } as ErrorState<T, R, A>);
      notifyListeners(fnCache.listeners);
      return reason;
    }
  );
}

function memoize(args) {
  return JSON.stringify(args); // todo: do it right!
}

function attemptHydratedCacheForApi(
  name: string
): Map<string, State<any, any, any>> | undefined {
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
        state.promise = promise;
      }
      if (state.status === "rejected") {
        // hack react use..
        let promise = Promise.resolve(state.data);
        // @ts-ignore
        promise.status = "rejected";
        // @ts-ignore
        promise.reason = state.data;
        state.promise = promise;
      }
      cache.set(argsHash, state);
    }
    return cache;
  }
}
