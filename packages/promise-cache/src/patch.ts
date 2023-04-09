import * as React from "react";
import {
  promiseCache,
  PromiseState,
  reverseCache,
  SubscriptionCache
} from "./cache";
import {evict} from "./use-promise";
import {isServer, maybeWindow} from "./utils";

declare global {
  interface Window {
    __HYDRATED_PROMISE_CACHE__?: Record<string, PromiseState<any, any>>;
  }
}

export function patchQuery<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  getCacheArg: (...args: A) => string,
): typeof fn {
  if (isServer) {
    return patchQueryInServer(fn, getCacheArg);
  }
  return patchQueryInClient(fn, getCacheArg);
}

function patchQueryInServer<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  getCacheArg: (...args: A) => string,
): typeof fn {
  return fn; // todo: implement this
}

function patchQueryInClient<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  getCacheArg: (...args: A) => string,
): typeof fn {
  return function constructPromise(...args: A) {
    let cacheHash = getCacheArg.apply(null, args)
    let hydratedData = getSavedHydratedDataForPromiseCacheEntry<T, any>(cacheHash)
    if (hydratedData) {
      let promise = bootPromiseFromState(cacheHash, hydratedData);
      promiseCache.set(cacheHash, promise);
      reverseCache.set(promise, createCache(cacheHash, promise, hydratedData));
      return promise;
    }

    let cachedPromise = promiseCache.get(cacheHash);
    if (cachedPromise) {
      return cachedPromise;
    }

    let promise = fn.apply(null, args);
    promiseCache.set(cacheHash, promise);
    reverseCache.set(promise, createCache(cacheHash, promise));
    return promise;
  }
}
function bootPromiseFromState<T, E>(hash: string, state: PromiseState<T, E>) {
  let promise: Promise<T>;
  if (state.status === "fulfilled") {
    promise = Promise.resolve(state.value)
  } else {
    promise = Promise.reject(state.reason)
  }
  return promise
}

export function patchMutation<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  getCacheArg: (...args: A) => string,
): typeof fn {
  return function modifiedMutation(...args: A) {
    let arg = getCacheArg.apply(null, args)
    let promise = fn.apply(null, args)
    return promise.then(result => {
      evict(arg);
      return result;
    })
  }
}

function createCache<T, E>(
  arg: string,
  promise: Promise<T>,
  hydratedState?: PromiseState<T, E> | undefined
) {
  let cache = {
    subscribe,
    active: true,
    state: hydratedState || null,
  } as SubscriptionCache<T, E>

  promise.then(
    fulfilledValue => {
      if (cache.active) {
        cache.state = {status: "fulfilled", value: fulfilledValue}
        React.startTransition(() => {
          if (cache.active && cache.listeners) {
            Object.values(cache.listeners).forEach(cb => cb(fulfilledValue))
          }
        });
      }
    },
    (error) => {
      if (cache.active) {
        cache.state = {status: "rejected", reason: error}
        React.startTransition(() => {
          if (cache.active && cache.listeners) {
            Object.values(cache.listeners).forEach(cb => cb(error))
          }
        });
      }
    }
  )

  function subscribe(cb: () => void) {
    if (!cache.index) {
      cache.index = 0
    }
    if (!cache.listeners) {
      cache.listeners = []
    }
    let id = ++cache.index
    cache.listeners[id] = cb
    return () => {
      delete cache.listeners![id]
    }
  }

  return cache;
}

function getSavedHydratedDataForPromiseCacheEntry<T, E>(
  arg: string
): PromiseState<T, E> | undefined {
  if (!maybeWindow || !maybeWindow.__HYDRATED_PROMISE_CACHE__) {
    return;
  }
  let existing = maybeWindow.__HYDRATED_PROMISE_CACHE__[arg]
  if (existing) {
    delete maybeWindow.__HYDRATED_PROMISE_CACHE__[arg]
  }
  return existing
}
