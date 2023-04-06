import * as React from "react";

type PromiseState<T, E> = {
  value: T,
  status: "fulfilled"
} | {
  status: "rejected",
  reason: E,
}

type SubscriptionCache<T, E> = {
  index?: number,
  active: boolean,
  state: PromiseState<T, E> | null
  listeners?: Record<number, (value: T | E) => void>,
  subscribe(cb: (value: T | E) => void): () => void, // returns unsubscribe
}

const promiseCache: Map<string, Promise<any>> = new Map<string, Promise<any>>()

const reverseCache: Map<Promise<any>, SubscriptionCache<any, any>>
  = new Map<Promise<any>, SubscriptionCache<any, any>>()

function createCache<T, E>(arg: string, promise: Promise<T>) {
  let subscriptionCache = {
    subscribe,
    state: null,
    active: true,
  } as SubscriptionCache<T, E>

  promise.then(
    fulfilledValue => {
      if (subscriptionCache.active) {
        subscriptionCache.state = {status: "fulfilled", value: fulfilledValue}
        if (subscriptionCache.listeners) {
          Object.values(subscriptionCache.listeners).forEach(cb => {
            React.startTransition(() => cb(fulfilledValue))
          })
        }
      }
    },
    (error) => {
      if (subscriptionCache.active) {
        subscriptionCache.state = {status: "rejected", reason: error}
        if (subscriptionCache.listeners) {
          Object.values(subscriptionCache.listeners).forEach(cb => {
            React.startTransition(() => cb(error))
          })
        }
      }
    }
  )

  function subscribe(cb: () => void) {
    if (!subscriptionCache.index) {
      subscriptionCache.index = 0
    }
    if (!subscriptionCache.listeners) {
      subscriptionCache.listeners = []
    }
    let id = ++subscriptionCache.index
    subscriptionCache.listeners[id] = cb
    return () => {
      delete subscriptionCache.listeners![id]
    }
  }

  return subscriptionCache;
}

export function patchQuery<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  getCacheArg: (...args: A) => string,
): typeof fn {

  function modified(...args: A) {
    let arg = getCacheArg.apply(null, args)
    let cachedPromise = promiseCache.get(arg)
    if (cachedPromise) {
      return cachedPromise
    }

    let promise = fn.apply(null, args)
    promiseCache.set(arg, promise)
    reverseCache.set(promise, createCache(arg, promise))
    return promise;
  }

  return modified;
}

export function usePromise<T, E = Error>(promise: Promise<T>): T {
  let subscription = reverseCache.get(promise)! as SubscriptionCache<T, E>
  let state = subscription.state;
  if (state === null) {
    throw promise;
  }
  if (state.status==="rejected") {
    throw state.reason
  }

  let rerender = React.useState<T | E>()[1]
  React.useEffect(() => subscription.subscribe(rerender), [subscription])

  return state.value
}

export function evict(arg: string) {
  let promise = promiseCache.get(arg)
  if (!promise) {
    return;
  }

  let subscription = reverseCache.get(promise)
  if (!subscription) {
    return
  }
  let returnValue = promiseCache.delete(arg) && reverseCache.delete(promise)

  subscription.active = false
  subscription.state = null

  let listeners = subscription.listeners;
  if (listeners) {
    let newObject = {}
    Object.values(listeners).forEach(cb => {
      React.startTransition(() => cb(newObject))
    })
  }

  return returnValue
}

