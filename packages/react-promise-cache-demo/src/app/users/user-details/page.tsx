import {Outlet, useParams} from "react-router-dom";
import {API} from "../../api";
import * as React from "react";
import Controls from "../../controls";
import {useApp} from "../../../main";
import {Link} from "../../Link";

async function getUserDetails(id: number) {
  // @ts-ignore
  let promise = await API.get(`/users/${id}`);
  return promise.data
}

export function Component() {
  let app = useApp();
  let {userId} = useParams();

  app.users.findById.inject(getUserDetails);

  // @ts-expect-error React.use isn't typed
  let user = React.use(app.users.findById(+userId));

  let rerender = React.useState()[1];
  React.useEffect(() => app.users.findById.subscribe(rerender), [])
  return (
    <Controls>
      <div>
        <details>
          <summary>User {user.username} details</summary>
          <pre>{JSON.stringify(user, null, 4)}</pre>
        </details>
        <Link href={`/users/${userId}/posts`}>see posts</Link>
        <hr/>
        <React.Suspense fallback={`Loading ${user.name}'s posts`}>
          <Outlet/>
        </React.Suspense>
      </div>
    </Controls>
  );
}
