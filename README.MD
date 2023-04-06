# React promise cache

## Example with axios:

```tsx
// api.ts

import axios from "axios";
import {patchQuery} from "react-promise-cache";

export const API = axios.create({
  baseURL: "https://jsonplaceholder.typicode.com",
});

let patchedGet = patchQuery(API.get, url => url)
API.get = patchedGet;


// users page
import * as React from "react";
import {usePromise} from "react-promise-cache";
import {Link, Outlet, useLocation} from "react-router-dom";
import {API} from "../api";

export function Component() {
  let search = useLocation().search
  let users = usePromise(API.get(`/users${search || ''}`)).data
  
  return (
    <details open>
      <summary>Users List</summary>
      <div style={{display: "flex", flexDirection: "column"}}>
        <div style={{display: "flex", flexDirection: "column"}}>
          {users.map(user => (
            <Link key={user.id} to={`${user.id}`}>{user.username}</Link>
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


// user details page:
import * as React from "react";
import {usePromise} from "react-promise-cache";
import {Link, Outlet, useParams} from "react-router-dom";
import {API} from "../../api";

export function Component() {
  let {userId} = useParams()
  let user = usePromise(API.get(`/users/${userId}`)).data

  return (
    <Controls>
      <div>
        <details>
          <summary>User {user.username} details</summary>
          <pre>{JSON.stringify(user, null, 4)}</pre>
        </details>
        <Link to="posts">see posts</Link>
        <hr/>
        <React.Suspense fallback={`Loading ${user.name}'s posts`}>
          <Outlet/>
        </React.Suspense>
      </div>
    </Controls>
  );
}
```

Try it [here](https://codesandbox.io/p/github/incepter/react-promise-cache-first-demo/)!


## Roadmap:

- [ ] Mutations
- [ ] SSR
- [ ] DEV helpers (non-patched and infinite loops...)
- [ ] Persist queries
- [ ] Events
