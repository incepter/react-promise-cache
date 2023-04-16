import * as React from "react";
import {
  Api,
  ApiEntry, ApiOptions, CacheConfig,
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
  definition: ApiEntry<T, R, A> | Producer<T, A> | undefined,
  cache: InternalApiCacheType<T, R, A>,
  optionsFromOutside?: ApiOptions<T, R, A>,
): Api<T, R, A> {
  let index = 0;
  let isCacheEnabled = true;
  let apiCache: InternalApiCacheValue<T, R, A> | undefined;
  let realFunction, name, options: ApiOptions<T, R, A> | undefined;

  refresh(optionsFromOutside);

  function refresh(newOptions) {
    // let lastOptions = options; todo: remove pending timeouts
    options = newOptions;
    if (options) {
      name = options.name;
      if (options.cacheConfig) {
        isCacheEnabled = !!options.cacheConfig.enabled;
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
    if (apiCache) {
      // spread new cache
      for (let [newKey, newState] of cacheToUse.entries()) {
        apiCache.calls.set(newKey, newState);
      }
    } else {
      apiCache = {
        name: name!,
        api: apiToken,
        calls: cacheToUse,
        reload: forceReloadCache,
        notify() {
          notifyListeners(apiCache!.listeners);
        },
      };
      cache.set(realFunction, apiCache);
    }
  }

  function ensureFunctionIsCached() {
    if (!cache.has(realFunction)) {
      forceReloadCache();
    } else {
      apiCache = cache.get(realFunction);
    }
  }

  let idd = 0
  function apiToken(...args: A): Promise<T> | State<T, R, A> {
    if (!realFunction) {
      throw new Error(`inject your ${name} function first`);
    }
    ensureFunctionIsCached();

    if (!isCacheEnabled) {
      // dangerous! infinite loops probability
      return realFunction.apply(null, args);
    }
    let runHash = memoize(args, options?.cacheConfig);
    let functionCache = apiCache!.calls;

    // existing
    if (functionCache.has(runHash)) {
      let cacheData = functionCache.get(runHash)!;
      // either with a promise or sync value
      return cacheData.promise ? cacheData.promise : cacheData;
    }
    let argsCopy = Array.from(args);
    let data = realFunction.apply(null, args);

    if (data && typeof data.then === "function") {
      trackPromiseResult(runHash, argsCopy, data, apiCache!);
    } else {
      // sync, no promise involved, mostly useReducer or useState
      functionCache.set(runHash, {
        data,
        args: argsCopy,
        status: "fulfilled",
      } as SuccessState<T, A>);
      notifyListeners(apiCache!.listeners);
    }
    let cacheData = functionCache.get(runHash)!;
    return cacheData.promise ? cacheData.promise : cacheData;
  }

  apiToken.evict = function evict(...args: A) {
    let argsHash = memoize(args, options?.cacheConfig);

    if (apiCache!.calls.has(argsHash)) {
      apiCache!.calls.delete(argsHash);
      notifyListeners(apiCache!.listeners);
    }

    return apiToken;
  };

  apiToken.use = function use(...args: A) {
    return useImpl(apiToken.apply(null, args));
  };

  apiToken.useState = function useState(...args: A) {
    apiToken.apply(null, args);
    let runHash = memoize(args, options?.cacheConfig);

    let rerender = React.useState()[1];
    React.useEffect(() => apiToken.subscribe(rerender), []);

    return apiCache!.calls.get(runHash)!;
  };

  apiToken.getState = function useState(...args: A) {
    apiToken.apply(null, args);

    let memoizedArgs = memoize(args, options?.cacheConfig);
    return apiCache!.calls.get(memoizedArgs)!;
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
    if (!apiCache!.listeners) {
      apiCache!.listeners = {};
    }
    apiCache!.listeners[id] = cb;
    return () => {
      delete apiCache!.listeners![id];
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

function memoize(args, options?: CacheConfig<any, any, any>) {
  if (options && typeof options.hash === "function") {
    return options.hash(args);
  }
  return JSON.stringify(args);
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
        // work around react.use..
        // @ts-ignore
        promise.status = "fulfilled";
        // @ts-ignore
        promise.value = state.data;
        state.promise = promise;
      }
      if (state.status === "rejected") {
        // work around react.use..
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
