"use client"
import * as React from "react";
import Link from "next/link";
import axios from "axios";
import {Hydration, useApi} from "react-promise-cache";

async function getUsers(): Promise<{id: string, username: string}[]> {
  let promise = await axios.get(`https://jsonplaceholder.typicode.com/users`);
  return promise.data
}

export default function Component() {
  let users = useApi(getUsers).use()
  return (
    <details open>
      <summary>Users List</summary>
      <div style={{display: "flex", flexDirection: "column"}}>
        <div style={{display: "flex", flexDirection: "column"}}>
          {users.map(user => <Link key={user.id}
                                   href={`/users/${user.id}`}>{user.username}</Link>)}
        </div>
      </div>
      <Hydration id="users_boundary" />
    </details>
  );
}
