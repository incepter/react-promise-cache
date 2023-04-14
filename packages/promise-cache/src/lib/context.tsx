import * as React from "react";
import {
  Api,
  AppContextType,
  DefaultShape,
  ProviderProps,
  State
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

export function useCache<T extends DefaultShape>(): Map<
  any,
  {
    name: string;
    api: Api<any, any, any>,
    calls: Map<string, State<any, any, any>>;
    listeners?: Record<number, (state: any) => void>;
  }
> {
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
