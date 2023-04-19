import * as React from "react";
import {
  Api,
  ApiOptions,
  CacheConfig, ErrorPromise,
  ErrorState,
  InternalApiCacheType, InternalApiCacheValue, PendingPromise,
  PendingState,
  Producer,
  State, SuccessPromise,
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
  return getOrCreateApi<T, R, A>(create, cache, options);
}

export function getOrCreateApi<T, R, A extends unknown[]>(
  create: Producer<T, A>,
  cache: InternalApiCacheType<T, R, A>,
  options?: ApiOptions<T, R, A>,
): Api<T, R, A> {
  if (create && cache.has(create)) {
    return cache.get(create)!.api;
  }

  let name = create.name;
  let isCacheEnabled = true;
  let subscriptionsIndex = 0;

  if (options) {
    if (options.name) {
      name = options.name;
    }
    if (options.cacheConfig && options.cacheConfig.enabled === false) {
      isCacheEnabled = false;
    }
  }

  forceReloadCache();

  function forceReloadCache() {
    let callsCacheToUse: Map<string, State<T, R, A>> | undefined;

    // when on client, try if there is a hydrated cache
    if (!isServer && isCacheEnabled) {
      let maybeHydratedCache = lookupHydratedCacheForName<T, R, A>(name);
      if (maybeHydratedCache) {
        callsCacheToUse = maybeHydratedCache;
      }
    }
    if (!callsCacheToUse) {
      callsCacheToUse = new Map();
    }

    let prevFunctionCache = cache.get(create);
    if (prevFunctionCache) {
      // append new cache
      if (isCacheEnabled) {
        for (let [newKey, newState] of callsCacheToUse.entries()) {
          prevFunctionCache.calls.set(newKey, newState);
        }
      }
    } else {
      prevFunctionCache = {
        name,
        api: apiToken,
        timeouts: new Map(),
        calls: callsCacheToUse,
        reload: forceReloadCache,
        notify() {
          notifyListeners(prevFunctionCache!.listeners);
        },
      };
      cache.set(create, prevFunctionCache);
    }
  }


  function apiToken(...args: A): Promise<T> | State<T, R, A> {
    let functionCache = cache.get(create)!;
    let cachedFunctionCalls = functionCache.calls;
    let callHash = memoize(args, options && options.cacheConfig);

    // existing
    if (isCacheEnabled && cachedFunctionCalls.has(callHash)) {
      let cacheData = cachedFunctionCalls.get(callHash)!;
      // either with a promise or sync state
      return cacheData.promise ? cacheData.promise : cacheData;
    }

    // if cache is not enabled, cache until next run occurs
    cachedFunctionCalls.delete(callHash);

    let result = create.apply(null, args);

    if (result && isPromise(result)) {
      trackPromise(functionCache, result, callHash, args, options?.cacheConfig);
    } else {
      // sync, no promise involved, mostly useReducer or useState
      cachedFunctionCalls.set(
        callHash,
        {data: result, args, status: "fulfilled"} as SuccessState<T, A>
      );
      notifyListeners(functionCache.listeners);
    }
    let cacheData = cachedFunctionCalls.get(callHash)!;
    return cacheData.promise ? cacheData.promise : cacheData;
  }

  apiToken.evict = function evict(...args: A) {
    let hashToEvict = memoize(args, options && options.cacheConfig);

    let functionCache = cache.get(create)!;
    let cachedFunctionCalls = functionCache.calls;

    if (cachedFunctionCalls.has(hashToEvict)) {
      cachedFunctionCalls.delete(hashToEvict);

      clearTimeout(functionCache.timeouts.get(hashToEvict));
      functionCache.timeouts.delete(hashToEvict);

      notifyListeners(functionCache.listeners);
    }

    return apiToken;
  };

  apiToken.use = function use(...args: A) {
    return useImpl(apiToken.apply(null, args));
  };

  apiToken.useState = function useState(...args: A) {
    let rerender = React.useState()[1];
    React.useEffect(() => apiToken.subscribe(rerender), []);

    return apiToken.getState.apply(null, args);
  };

  apiToken.getState = function useState(...args: A) {
    let memoizedArgs = memoize(args, options && options.cacheConfig);
    apiToken.apply(null, args);

    return cache.get(create)!.calls.get(memoizedArgs)!;
  };

  apiToken.subscribe = function subscribe(cb) {
    let id = ++subscriptionsIndex;
    let exitingFunctionCache = cache.get(create)!;
    if (!exitingFunctionCache.listeners) {
      exitingFunctionCache.listeners = {};
    }
    exitingFunctionCache.listeners[id] = cb;
    return () => {
      delete exitingFunctionCache.listeners![id];
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

function trackPromise<T, R, A extends unknown[]>(
  functionCache: InternalApiCacheValue<T, R, A>,
  promise: Promise<T>,
  hash: string,
  args: A,
  cacheConfig?: CacheConfig<T, R, A>
) {
  let callsCache = functionCache.calls;
  callsCache.set(hash, {
    args: args,
    data: promise,
    status: "pending",
    promise: promise,
  } as PendingState<T, A>);

  let functionTimeouts = functionCache.timeouts;
  if (functionTimeouts.has(hash)) {
    clearTimeout(functionTimeouts.get(hash));
    functionTimeouts.delete(hash);
  }

  notifyListeners(functionCache.listeners);

  promise.then(
    (result) => {
      callsCache.set(hash, {
        data: result,
        args: args,
        status: "fulfilled",
        promise: promise,
      } as SuccessState<T, A>);


      let deadline: number | null = null;
      let configuredDeadline = cacheConfig && cacheConfig.deadline
      if (typeof configuredDeadline === "function") {
        deadline = configuredDeadline(result) || null
      } else if (typeof configuredDeadline === "number") {
        deadline = configuredDeadline;
      }

      if (deadline) {
        let id = setTimeout(() => {
          functionCache.calls.delete(hash);
          functionTimeouts.delete(hash);
          clearTimeout(functionTimeouts.get(hash));
          notifyListeners(functionCache.listeners);
        }, deadline);
        functionTimeouts.set(hash, id);
      }

      notifyListeners(functionCache.listeners);
      return result;
    },
    (reason) => {
      callsCache.set(hash, {
        data: reason,
        args: args,
        status: "rejected",
        promise: promise,
      } as ErrorState<T, R, A>);
      notifyListeners(functionCache.listeners);
      return reason;
    }
  );
}

function memoize(args, options?: CacheConfig<any, any, any>) {
  if (options && typeof options.hash === "function") {
    return options.hash(args);
  }
  return JSON.stringify(args);
}

function lookupHydratedCacheForName<T, R, A extends unknown[]>(
  name: string
): Map<string, State<T, R, A>> | undefined {
  let hydratedCache = maybeWindow!.__HYDRATED_APP_CACHE__;
  if (hydratedCache && hydratedCache[name]) {
    let cache = new Map();
    for (let [argsHash, state] of Object.entries(hydratedCache[name])) {
      if (state.status === "fulfilled") {
        let promise = Promise.resolve(state.data) as SuccessPromise<any>;
        // work around react.use..
        promise.status = "fulfilled";
        promise.value = state.data;
        state.promise = promise;
      }
      if (state.status === "rejected") {
        // reject here causes chaos!
        let promise = Promise.resolve(state.data) as ErrorPromise<any, any>;
        // work around react.use..
        promise.status = "rejected";
        promise.reason = state.data;
        state.promise = promise;
      }
      if (state.status === "pending") {
        let promise = new Promise(() => {}) as PendingPromise<any>;
        // work around react.use..
        promise.status = "pending";
        state.promise = promise;
      }
      cache.set(argsHash, state);
    }
    return cache;
  }
}
function isPromise<T>(obj: Promise<T> | any): obj is Promise<T> {
  return typeof obj.then === "function";
}
