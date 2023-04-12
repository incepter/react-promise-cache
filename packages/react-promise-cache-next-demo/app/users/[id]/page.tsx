"use client"
import * as React from "react";
import axios from "axios";
import {Hydration, useApi} from "react-promise-cache";
import DefaultErrorBoundary from "@/app/error-boundary";

async function getUserDetails(id: number) {
  let promise = await axios.get(`https://jsonplaceholder.typicode.com/users/${id}`);
  return promise.data
}

function RealThing({id}: { id: number }) {
  let user = useApi(getUserDetails).use(id);
  // console.log('promise', promise)
  // let user = React.use(promise);
  return (
    <details open>
      <summary>User {user.name} details</summary>
      <div style={{display: "flex", flexDirection: "column"}}>
        <div style={{display: "flex", flexDirection: "column"}}>
          <pre>
            {JSON.stringify(user, null, 4)}
          </pre>
        </div>
      </div>
      <Hydration id="user_details_boundary"/>
    </details>
  );
}

export default function Component({params: {id}}) {
  return (
    <DefaultErrorBoundary>
      <RealThing id={id}/>
    </DefaultErrorBoundary>
  )
}
