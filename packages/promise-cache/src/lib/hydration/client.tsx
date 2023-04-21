import * as React from "react";
import {useCache} from "../context";
import {maybeWindow} from "../../utils";

export function HydrationClient({id}: {id: string}) {
  let cache = useCache();
  let existingHtml = React.useRef<string | null>();
  if (!existingHtml.current) {
    let existingContainer = document.getElementById(id);
    existingHtml.current = existingContainer && existingContainer.innerHTML;
  }

  React.useEffect(() => {
    let hasHydratedData = !!(maybeWindow && maybeWindow.__HYDRATED_APP_CACHE__);
    if (!hasHydratedData) {
      return;
    }
    let hydrationData = maybeWindow!.__HYDRATED_APP_CACHE__!;
    React.startTransition(() => {
      // todo: correctly do this
      for (let fnCache of cache.values()) {
        let maybeFnData = hydrationData[fnCache.name];
        if (maybeFnData) {
          fnCache.reload();
          fnCache.notify();
        }
      }
    })
  }, [id, cache]);

  return existingHtml.current ? (
    <script
      id={id}
      dangerouslySetInnerHTML={{
        __html: existingHtml.current,
      }}
    ></script>
  ) : null;
}
