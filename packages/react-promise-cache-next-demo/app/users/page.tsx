"use client"
import * as React from "react";
import Link from "next/link";
import axios from "axios";
import {useApi} from "react-application";

async function getUsers(): Promise<{id: string, username: string}[]> {
  let promise = await axios.get(`https://jsonplaceholder.typicode.com/users`);
  return promise.data
}

async function getUserDetails(id: number) {
  let promise = await axios.get(`https://jsonplaceholder.typicode.com/users/${id}`);
  return promise.data
}

export default async function Component({searchParams}) {
  // @ts-ignore
  let users = React.use(useApi(getUsers)())
  // @ts-ignore
  let user1 = React.use(useApi(getUserDetails)(1))
  console.log('_______________________________________user 1 data', user1)
  return (
    <details open>
      <summary>Users List</summary>
      <div style={{display: "flex", flexDirection: "column"}}>
        <div style={{display: "flex", flexDirection: "column"}}>
          {users.map(user => <Link key={user.id}
                                   href={`/users/${user.id}`}>{user.username}</Link>)}
        </div>
      </div>
    </details>
  );
}
