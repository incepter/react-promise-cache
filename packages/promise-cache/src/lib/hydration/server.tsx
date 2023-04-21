import * as React from "react";
import {useCache} from "../context";
import {State} from "../../types";
import {stringify} from "../../utils";

export function HydrationServer({id}: {id: string}) {
  let cache = useCache();
  let entries: Record<string, Record<string, State<any, any, any>>> = {};
  for (let {name, calls} of cache.values()) {
    entries[name] = transformForHydratedCallsCache(calls);
  }

  let assignment = `Object.assign(window.__HYDRATED_APP_CACHE__ || {}, ${stringify(
    entries,
    30
  )})`;
  return (
    <script
      id={id}
      dangerouslySetInnerHTML={{
        __html: `window.__HYDRATED_APP_CACHE__ = ${assignment}`,
      }}
    ></script>
  );
}

function transformForHydratedCallsCache(
  calls: Map<string, State<any, any, any>>
) {
  return [...calls.entries()].reduce((acc, curr) => {
    let {promise, ...rest} = curr[1];
    acc[curr[0]] = rest;
    return acc;
  }, {});
}
