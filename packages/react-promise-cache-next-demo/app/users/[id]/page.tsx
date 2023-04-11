"use client"
import * as React from "react";
import Link from "next/link";
import axios from "axios";
import {Hydration, useApi} from "react-promise-cache";

export let maybeWindow = typeof window !== "undefined" ? window : undefined;
export let isServer = !maybeWindow ||
  !maybeWindow.document ||
  !maybeWindow.document.createComment;

async function getUsers(): Promise<{id: string, username: string}[]> {
  let promise = await axios.get(`https://jsonplaceholder.typicode.com/users`);
  return promise.data
}

async function getUserDetails(id: number) {
  let promise = await axios.get(`https://jsonplaceholder.typicode.com/users/${id}`);
  return promise.data
}

export default function Component({params: {id}}) {
  // @ts-ignore
  let user = React.use(useApi(getUserDetails)(id))
  return (
    <details open>
      <summary>User {user.name} details </summary>
      <div style={{display: "flex", flexDirection: "column"}}>
        <div style={{display: "flex", flexDirection: "column"}}>
          <pre>
            {JSON.stringify(user, null, 4)}
          </pre>
        </div>
      </div>
      <Hydration id="user_details_boundary" />
    </details>
  );
}
