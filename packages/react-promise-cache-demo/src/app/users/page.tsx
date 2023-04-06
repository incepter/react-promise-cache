import * as React from "react";
import {API} from "../api";
import {Link, Outlet, useLocation} from "react-router-dom";
import {usePromise} from "react-promise-cache";

export function Component() {
  let search = useLocation().search
  let users = usePromise(API.get(`/users${search || ''}`)).data
  return (
    <details open>
      <summary>Users List</summary>
      <div style={{display: "flex", flexDirection: "column"}}>
        <div style={{display: "flex", flexDirection: "column"}}>
          {users.map(user => <Link key={user.id}
                                   to={`${user.id}`}>{user.username}</Link>)}
        </div>
        <hr/>
        <React.Suspense fallback={`Loading user details`}>
          <Outlet/>
        </React.Suspense>
      </div>
    </details>
  );
}
