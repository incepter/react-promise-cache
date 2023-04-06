export type PromiseState<T, E> =
  { status: "fulfilled", value: T } |
  { status: "rejected", reason: E, }

export type SubscriptionCache<T, E> = {
  index?: number,
  active: boolean,
  state: PromiseState<T, E> | null
  listeners?: Record<number, (value: T | E) => void>,
  subscribe(cb: (value: T | E) => void): () => void, // returns unsubscribe
}

export const promiseCache: Map<string, Promise<any>>
  = new Map<string, Promise<any>>()

export const reverseCache: Map<Promise<any>, SubscriptionCache<any, any>>
  = new Map<Promise<any>, SubscriptionCache<any, any>>()
