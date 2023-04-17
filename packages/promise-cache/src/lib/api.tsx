import * as React from "react";
import {
  Api,
  ApiEntry,
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
  return createApi<T, R, A>(create, cache, options);
}

export function createApi<T, R, A extends unknown[]>(
  definition: ApiEntry<T, R, A> | Producer<T, A> | undefined,
  cache: InternalApiCacheType<T, R, A>,
  optionsFromOutside?: ApiOptions<T, R, A>,
): Api<T, R, A> {
  let index = 0;
  let isCacheEnabled = true;
  let realFunction, name, options: ApiOptions<T, R, A> | undefined;

  refresh(optionsFromOutside);

  function refresh(newOptions) {
    if (newOptions) {
      options = newOptions;
    }
    if (options) {
      if (options.name) {
        name = options.name;
      }
      if (options.cacheConfig && options.cacheConfig.enabled === false) {
        isCacheEnabled = false;
      } else {
        isCacheEnabled = true;
      }
    }
  }

  if (definition) {
    if (typeof definition === "function") {
      realFunction = definition;
      if (!name) {
        name = realFunction.name;
      }
      if (cache.get(realFunction)) {
        return cache.get(realFunction)!.api;
      }
    } else if (definition.producer) {
      realFunction = definition.producer;
      if (!name) {
        name = realFunction.name;
      }
      if (cache.get(realFunction)) {
        return cache.get(realFunction)!.api;
      }
    }
  }
  ensureFunctionIsCached();

  function forceReloadCache() {
    let callsCacheToUse: Map<string, State<T, R, A>> | undefined;
    if (!isServer && isCacheEnabled) {
      let hydratedCache = attemptHydratedCacheForApi<T, R, A>(name);
      if (hydratedCache) {
        callsCacheToUse = hydratedCache;
      }
    }
    if (!callsCacheToUse) {
      callsCacheToUse = new Map();
    }
    let exitingFunctionCache = cache.get(realFunction);
    if (exitingFunctionCache) {
      // spread new cache
      if (isCacheEnabled) {
        for (let [newKey, newState] of callsCacheToUse.entries()) {
          exitingFunctionCache.calls.set(newKey, newState);
        }
      }
    } else {
      exitingFunctionCache = {
        name,
        api: apiToken,
        timeouts: new Map(),
        calls: callsCacheToUse,
        reload: forceReloadCache,
        notify() {
          notifyListeners(exitingFunctionCache!.listeners);
        },
      };
      cache.set(realFunction, exitingFunctionCache);
    }
  }

  function ensureFunctionIsCached() {
    if (realFunction && !cache.has(realFunction)) {
      forceReloadCache();
    }
  }

  function apiToken(...args: A): Promise<T> | State<T, R, A> {
    if (!realFunction) {
      throw new Error(`inject your ${name} function first`);
    }
    ensureFunctionIsCached();

    let currentCallHash = memoize(args, options && options.cacheConfig);
    let functionCache = cache.get(realFunction)!;
    let cachedFunctionCalls = functionCache.calls;

    // existing
    if (cachedFunctionCalls.has(currentCallHash) && isCacheEnabled) {
      let cacheData = cachedFunctionCalls.get(currentCallHash)!;
      // either with a promise or sync value
      return cacheData.promise ? cacheData.promise : cacheData;
    }

    // cache is not enabled, so always cache until next run occurs
    cachedFunctionCalls.delete(currentCallHash);

    let argsCopy = Array.from(args) as A;
    let result = realFunction.apply(null, args);

    if (result && typeof result.then === "function") {
      trackPromiseResult(
        functionCache, result,
        currentCallHash, argsCopy, options && options.cacheConfig
      );
    } else {
      // sync, no promise involved, mostly useReducer or useState
      cachedFunctionCalls.set(
        currentCallHash,
        {data: result, args: argsCopy, status: "fulfilled"} as SuccessState<T, A>
      );
      notifyListeners(functionCache.listeners);
    }
    let cacheData = cachedFunctionCalls.get(currentCallHash)!;
    return cacheData.promise ? cacheData.promise : cacheData;
  }

  apiToken.evict = function evict(...args: A) {
    let hashToEvict = memoize(args, options && options.cacheConfig);

    let functionCache = cache.get(realFunction)!;
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

    return cache.get(realFunction)!.calls.get(memoizedArgs)!;
  };

  apiToken.inject = function inject(fn, opts?: ApiOptions<T, R, A>) {
    options = opts;
    realFunction = fn;
    refresh(opts);
    if (!name) {
      name = realFunction.name;
    }
    ensureFunctionIsCached();
    return apiToken;
  };

  apiToken.subscribe = function subscribe(cb) {
    let id = ++index;
    let exitingFunctionCache = cache.get(realFunction)!;
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

function trackPromiseResult<T, R, A extends unknown[]>(
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

function attemptHydratedCacheForApi<T, R, A extends unknown[]>(
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
        let promise = new Promise(res => {}) as PendingPromise<any>;
        // work around react.use..
        promise.status = "pending";
        state.promise = promise;
      }
      cache.set(argsHash, state);
    }
    return cache;
  }
}
