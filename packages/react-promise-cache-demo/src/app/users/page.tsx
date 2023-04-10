import * as React from "react";
import {Outlet} from "react-router-dom";
import {useApp} from "../../main";
import {Link} from "../Link";

export function Component() {
  // @ts-expect-error React.use isn't typed
  let users = React.use(useApp().users.list());
  return (
    <details open>
      <summary>Users List</summary>
      <div style={{display: "flex", flexDirection: "column"}}>
        <div style={{display: "flex", flexDirection: "column"}}>
          {users.map(user => <Link key={user.id}
                                   href={`/users/${user.id}`}>{user.username}</Link>)}
        </div>
        <hr/>
        <React.Suspense fallback={`Loading user details`}>
          <Outlet/>
        </React.Suspense>
      </div>
    </details>
  );
}
