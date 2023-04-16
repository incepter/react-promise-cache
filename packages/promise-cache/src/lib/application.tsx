import * as React from "react";
import {
  ApiEntry,
  AppEntry,
  Application,
  DefaultShape,
  ExtendedFn,
  InternalApiCacheType,
  ProviderProps,
} from "../types";
import {AppProvider, PromiseCacheContext} from "./context";
import {createApi} from "./api";

export function useApp<T extends DefaultShape>(): Application<T> {
  let result = React.useContext(PromiseCacheContext);
  if (!result) {
    throw new Error("Add <AppProvider /> up in your tree");
  }
  return result.app!;
}

export function createApp<Shape extends DefaultShape>(
  shape: AppEntry<Shape>,
  cache?: Map<any, any>,
) {
  let cacheToUse = cache || new Map();
  let app = createAppForShape(cacheToUse, shape) as Application<Shape>;
  return {
    app,
    Provider({children}: ProviderProps<Shape>) {
      return (
        <AppProvider cache={cacheToUse} app={app} shape={shape}>
          {children}
        </AppProvider>
      );
    },
    useApp: () => useApp<Shape>(),
  };
}

function createAppForShape(
  cache: InternalApiCacheType<any, any, any>,
  shape?: Record<string, Record<string, any>>
) {
  const app = {};
  if (!shape) {
    return app;
  }
  for (let [resourceName, resource] of Object.entries(shape)) {
    let currentResource = {};
    for (let [apiName, apiDefinition] of Object.entries(resource)) {
      let name = `${resourceName}_${apiName}`;
      currentResource[apiName] = createApi(apiDefinition, cache, {name});
    }
    app[resourceName] = currentResource;
  }

  return app;
}

let defaultJT = {fn: {}};

function buildDefaultJT<T, R, A extends unknown[]>(): {
  fn: ExtendedFn<T, R, A>;
} {
  return defaultJT as { fn: ExtendedFn<T, R, A> };
}

export function api<T, R, A extends unknown[]>(
  props?: Omit<ApiEntry<T, R, A>, "fn">
): ApiEntry<T, R, A> {
  return Object.assign({}, props, buildDefaultJT<T, R, A>());
}
