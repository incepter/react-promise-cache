import {Link, Outlet, useParams} from "react-router-dom";
import {usePromise} from "react-promise-cache";
import {API} from "../../api";
import * as React from "react";
import Controls from "../../controls";

export function Component() {
  let {userId} = useParams()
  let user = usePromise(API.get(`/users/${userId}`)).data

  return (
    <Controls>
      <div>
        <details>
          <summary>User {user.username} details</summary>
          <pre>{JSON.stringify(user, null, 4)}</pre>
        </details>
        <Link to="posts">see posts</Link>
        <hr/>
        <React.Suspense fallback={`Loading ${user.name}'s posts`}>
          <Outlet/>
        </React.Suspense>
      </div>
    </Controls>
  );
}
