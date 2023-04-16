import * as React from "react";
import {
  AppContextType,
  DefaultShape,
  InternalApiCacheType,
  ProviderProps
} from "../types";
import {isServer} from "../utils";

export const PromiseCacheContext =
  React.createContext<AppContextType<any> | null>(null);

export function AppProvider<T extends DefaultShape>({
  children,
  shape,
  cache,
  app,
}: ProviderProps<T>) {
  let self = React.useMemo(() => {
    let cacheToUse = cache || new Map();

    return {
      app,
      cache: cacheToUse,
    };
  }, [app, shape, cache]);

  return (
    <PromiseCacheContext.Provider value={self}>
      {children}
    </PromiseCacheContext.Provider>
  );
}

export function useCache<T, R, A extends unknown[]>(): InternalApiCacheType<T, R, A> {
  let context = React.useContext(PromiseCacheContext);
  return React.useMemo(() => {
    if (!context) {
      if (isServer) {
        throw new Error(
          "You cannot work without context, or use your own cache."
        );
      }
      if (!globalThis.__PROMISE_CACHE__) {
        globalThis.__PROMISE_CACHE__ = new Map();
      }
      return globalThis.__PROMISE_CACHE__;
    }
    return context.cache;
  }, [context]);
}
