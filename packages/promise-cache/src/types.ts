import * as React from "react";

export type SomethingIrrelevant = {};
export type Producer<T, A extends unknown[]> = (...args: A) => T | Promise<T>;
export type DefaultFn<T, R, A extends unknown[]> = Producer<T, A>;
export type ExtendedFn<T, R, A extends unknown[]> =
  | DefaultFn<T, R, A>
  | SomethingIrrelevant;
export type DefaultShape = Record<string, Record<string, any>>;

export interface ApiEntry<
  T extends unknown,
  R extends unknown,
  A extends unknown[]
> extends ApiCreationConfigObject<T, R, A> {
  fn: ExtendedFn<T, R, A>;
}

export interface ApiCreationConfigObject<T, R, A extends unknown[]> {
  producer?: Producer<T, A>,
}

export type InternalApiCacheValue<T, R, A extends unknown[]> = {
  name: string;
  api: Api<T, R, A>,
  notify: () => void,
  reload: () => void,
  calls: Map<string, State<T, R, A>>;
  listeners?: Record<number, (state: any) => void>;
  timeouts: Map<string, ReturnType<typeof setTimeout>>;
}

export interface ApiOptions<T, R, A extends unknown[]> {
  name?: string,
  cacheConfig?: CacheConfig<T, R, A>,
}

export type CacheConfig<T, R, A extends unknown[], Hash = string> = {
  // enabled: false would disabled entirely caching
  // in dev mode, we may add a tight limit in dev mode to detect unwanted behavior
  enabled?: boolean;
  // The actual function call hash, will be calculated from the call args
  hash?(...args: A): Hash;
  // whether the current resolved state should be saved or not
  // not saving it means removing the entry from the cache (because it was pending)
  // and then it will create another one again! this may lead to infinite loops
  // we may add a count of the sequential failures or decisions not to cache, so
  // retry can be implemented just using that.
  // todo: maybe later!
  // cache?(s: ResolvedState<T, R, A>): boolean;
  // the deadline after which a state that will be cached will become stale
  // and thus would be automatically evicted
  deadline?: number | ((s: T) => number);
  // loads either synchronously or asynchronously the cache
  // can be used with either localStorage or AsyncStorage
  load?():
    | Map<Hash, ResolvedState<T, R, A>>
    | Promise<Map<Hash, ResolvedState<T, R, A>>>;
  // should give you the cache after each change to it so you will persist it again
  // it won't be reloaded right away, since it should stay the same
  // you can configure the deadline otherwise!
  persist?(cache: Map<Hash, ResolvedState<T, R, A>>): void;
};

export type InternalApiCacheType<T, R, A extends unknown[]> = Map<
  any,
  InternalApiCacheValue<T, R, A>
>

export type AppEntry<T extends DefaultShape> = {
  [resource in keyof T]: {
    [api in keyof T[resource]]: ApiEntry<
      T[resource][api]["fn"] extends ExtendedFn<
          infer T,
          infer R,
          infer A extends unknown[]
        >
        ? T
        : never,
      T[resource][api]["fn"] extends ExtendedFn<
          infer T,
          infer R,
          infer A extends unknown[]
        >
        ? R
        : never,
      T[resource][api]["fn"] extends ExtendedFn<
          infer T,
          infer R,
          infer A extends unknown[]
        >
        ? A
        : never
    >;
  };
};

export type Application<T extends DefaultShape> = {
  [resource in keyof T]: {
    [api in keyof T[resource]]: Api<
      T[resource][api]["fn"] extends ExtendedFn<
          infer T,
          infer R,
          infer A extends unknown[]
        >
        ? T
        : never,
      T[resource][api]["fn"] extends ExtendedFn<
          infer T,
          infer R,
          infer A extends unknown[]
        >
        ? R
        : never,
      T[resource][api]["fn"] extends ExtendedFn<
          infer T,
          infer R,
          infer A extends unknown[]
        >
        ? A
        : never
    >;
  };
};

export type PendingState<T, A extends unknown[]> = {
  args: A;
  data: Promise<T>;
  status: "pending";
  promise: Promise<T>;
  hydrated?: true;
};
export type SuccessState<T, A extends unknown[]> = {
  args: A;
  data: T;
  status: "fulfilled";
  promise: Promise<T>;
  hydrated?: true;
};
export type ErrorState<T, R, A extends unknown[]> = {
  args: A;
  data: R;
  status: "rejected";
  promise: Promise<T>;
  hydrated?: true;
};
// T: data type, R: reason of rejection, A args!
export type ResolvedState<T, R, A extends unknown[]> =
  | SuccessState<T, A>
  | ErrorState<T, R, A>;
// T: data type, R: reason of rejection, A args!
export type State<T, R, A extends unknown[]> =
  | PendingState<T, A>
  | SuccessState<T, A>
  | ErrorState<T, R, A>;

export type Api<T, R, A extends unknown[]> = {
  (...args: A): State<T, R, A> | Promise<T>;

  use(...args: A): T;
  evict(...args: A): Api<T, R, A>;
  getState(...args: A): State<T, R, A>;
  useState(...args: A): State<T, R, A>;
  inject(fn: (...args: A) => T | Promise<T>, options?: ApiOptions<T, R, A>): Api<T, R, A>;
  subscribe(cb: (t: T | Promise<T> | any) => void): () => void;
};

declare global {
  interface Window {
    __HYDRATED_APP_CACHE__?: Record<
      string,
      Record<string, State<any, any, any>>
    >;
  }
}

export type ProviderProps<T extends DefaultShape> = {
  shape?: T;
  app?: Application<T>;
  children: React.ReactNode;
  cache?: InternalApiCacheType<any, any, any>;
};

export type AppContextType<T extends DefaultShape> = {
  cache: InternalApiCacheType<any, any, any>
  app?: Application<T>;
};
