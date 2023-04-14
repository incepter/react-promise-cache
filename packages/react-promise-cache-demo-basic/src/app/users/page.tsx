import * as React from "react";
import {Link, Outlet} from "react-router-dom";
import {useApi} from "react-promise-cache";
import {API} from "../api";
import {UserType} from "./types";

export async function getUsersList() {
  // await new Promise(res => setTimeout(res, 20000))
  let promise = await API.get<UserType[]>(`/users`);
  return promise.data
}

export function Component() {
  let users = useApi(getUsersList).use();
  return (
    <details open>
      <summary>Users List</summary>
      <div style={{display: "flex", flexDirection: "column"}}>
        <div style={{display: "flex", flexDirection: "column"}}>
          {users.map(u => (
            <Link key={u.id} to={`${u.id}`}>
              {u.id} - {u.username}
            </Link>
          ))}
        </div>
        <hr/>
        <React.Suspense fallback={`Loading user details`}>
          <Outlet/>
        </React.Suspense>
      </div>
    </details>
  );
}
