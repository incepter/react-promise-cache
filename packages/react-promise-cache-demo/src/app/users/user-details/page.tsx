import {Outlet, useParams} from "react-router-dom";
import {API} from "../../api";
import * as React from "react";
import Controls from "../../controls";
import {app} from "../../../main";
import {Link} from "../../Link";

async function getUserDetails(id: number) {
  let promise = await API.get(`/users/${id}`);
  return promise.data
}

export function Component() {
  let {userId} = useParams();

  app.users.findById.inject(getUserDetails);
  // console.log('AN STATE IS !!', app.users.findById.useState(11))

  // @ts-expect-error React.use isn't typed
  let user = React.use(app.users.findById(+userId));
  // let result = app.users.findById.useState(+userId);

  let rerender = React.useState()[1];
  React.useEffect(() => app.users.findById.subscribe(rerender), [])
  // if (result.status === "rejected") {
  //   return null;
  // }
  // if (result.status === "pending") {
  //   return null;
  // }
  //
  // let user = result.data;

  return (
    <Controls>
      <div style={{display: "flex", flexDirection: "column"}}>
        <div>
          <details open>
            <summary>User {user.username} details</summary>
            <pre>{JSON.stringify(user, null, 4)}</pre>
          </details>
          <Link href={`/users/${userId}/posts`}>see posts</Link>
        </div>
        <React.Suspense fallback={`Loading ${user.name}'s posts`}>
          <Outlet/>
        </React.Suspense>
      </div>
    </Controls>
  );
}
