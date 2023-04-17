import {Link, Outlet, useParams} from "react-router-dom";
import {API} from "../../api";
import * as React from "react";
import {useApi} from "react-promise-cache";
import Controls from "../../controls";

export async function getUserDetails(id: number) {
  let promise = await API.get(`/users/${id}`);
  return promise.data
}

export function Component() {
  let {userId} = useParams();

  let api = useApi(getUserDetails, {cacheConfig: {deadline: 2000}});
  let user = api.use(+userId!);

  let rerender = React.useState()[1];
  React.useEffect(() => api.subscribe(rerender), [])

  return (
    <Controls>
      <div style={{display: "flex", flexDirection: "column"}}>
        <div>
          <details open>
            <summary>User {user.username} details</summary>
            <pre>{JSON.stringify(user, null, 4)}</pre>
          </details>
          <Link to={`posts`}>see posts</Link>
        </div>
        <React.Suspense fallback={`Loading ${user.name}'s posts`}>
          <Outlet/>
        </React.Suspense>
      </div>
    </Controls>
  );
}
