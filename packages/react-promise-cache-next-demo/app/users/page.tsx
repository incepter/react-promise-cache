"use client"
import * as React from "react";
import {API} from "../api";
import {Boundary, usePromise} from "react-promise-cache";
import Link from "next/link";

export default function Component({searchParams}) {
  let users = usePromise(API.get(`/users`)).data
  return (
    <Boundary forceInclude={{"/users": true}}>
      <details open>
        <summary>Users List</summary>
        <div style={{display: "flex", flexDirection: "column"}}>
          <div style={{display: "flex", flexDirection: "column"}}>
            {users.map(user => <Link key={user.id}
                                     href={`/users/${user.id}`}>{user.username}</Link>)}
          </div>
        </div>
      </details>
    </Boundary>
  );
}
