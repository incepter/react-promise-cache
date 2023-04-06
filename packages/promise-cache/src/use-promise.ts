import * as React from "react";
import {promiseCache, reverseCache, SubscriptionCache} from "./cache";

export function usePromise<T, E = Error>(promise: Promise<T>): T {
  let subscription = reverseCache.get(promise)! as SubscriptionCache<T, E>
  let state = subscription.state;
  if (state === null) {
    throw promise;
  }
  if (state.status === "rejected") {
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
