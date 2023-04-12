# React application cache


## TL;DR

The idea behind this library is that you will be able to cache promises that
you receive from different functions in your application, hydrate them and
boot from their data.

Note: I explained better the library in this [twitter thread](https://twitter.com/incepterr/status/1645540428563857414).

```tsx
import {useApp} from "react-promise-cache"

function MyComponent() {
  const app = useApp()
  const {userId} = useParam()
  const promise = app.users.findById(userId)
  
  const data = React.use(promise)
  // do something with data
}
```

In the previous example, `app.users.findById(userId)` will return the same
promise until you change the userId and then you will have a new promise.

## The API
Here is the different parts of the API that the library supports

### `AppProvider`
The `provider` is a React Context Provider that you should use to share, cache
and isolate your data.
It accepts one optional prop: `shape`, which is the shape of your application:

```tsx
// the api function returns just a placeholder, and it allows you to define
// types for you APIs before injecting them at runtime.
import {api} from "react-promise-cache";

const myAppShape = {
  resource1: {
    api1: api<ApiDataType, ApiErrorType, [ApiArgs1, ApiArgs2]>(),
  },
  resource2: {},
  // ...
  resourceN: {},
}
```

For example, consider the following shape:
It defines a shape of an application for users management: search via query,
find a user by its ID or add a new user.
```tsx
import {api} from "react-promise-cache";
const myApp = {
  users: {
    search: api<Page<User>, Error, [string?]>(),
    findById: api<User, Error, [number]>(),
    add: api<User, Error, [Omit<User, "id">]>(),
  }
}
```
PS: You can omit this prop or pass an empty object to the provider.

### `useApp`

The `useApp` hook will return a shape similar to your `AppShape` that you gave
to the provider (with resources and their APIs), but the API will be a token
with the following type:

```tsx
type Api<T, R, A extends unknown[]> = {
  // when invoked, it either returns T or a promise to it
  // depending on your function and project needs.
  (...args: A): T | Promise<T>,

  // this injects the real functions into your API
  // this allows the API to be lazy-loaded and type-safe at the same time
  inject(fn: (...args: A) => (T | Promise<T>)): Api<T, R, A>

  // will remove the cached data for the given arguments
  evict(...args: A): Api<T, R, A>,
  
  // performs subscription to an api and is notified when the api's cache is invalidated
  subscribe(cb: (t: T | Promise<T> | any) => void): (() => void),
}
```

Notes:
- If you try to make a promise before injecting, it will throw and error
- subscribe will get only notified (for now) when a cache entry is removed
- useApp does not perform any subscription, and only uses the parent context

### `useApi`
`useApi` is designed to work without the `shape` that you provided to your
provider, but will use the same cache anyways;

Here is useAPI signature and definition:
```tsx
export function useApi<T, R, A extends unknown[]>(
  create: (...args: A) => (T | Promise<T>),
  deps = [],
  name = create.name
) {
  let cache = useCache();
  return React.useMemo(() => {
    let token = createApi<T, R, A>(undefined, cache, name)
    token.inject(create)
    return token;
  }, deps)
}
```
This means that you can control your API via dependencies and do awesome stuff!

The return of `useAPI` is the same as any API from `useApp`.

### `createApp`
Take a look at its definition:

```tsx
export function createApp<Shape extends DefaultShape>(shape: AppEntry<Shape>) {
  return {
    Provider({children}: { children: React.ReactNode }) {
      return <AppProvider shape={shape}>{children}</AppProvider>
    },
    useApp(): Application<Shape> {
      return useAppContext<Shape>().app
    }
  }
}
```
It returns the `AppProvider` and `useApp` bound to a `shape`, so types are very
well defined and you can get awesome auto-complete capabilities without
even annotating `useApp` with your shape type!

### `useCache`
`useCache` returns the cache that the parent `AppProvider` uses.
Unless you are doing some advanced stuff, you don't need this API.

## Examples:

### CSR

In a complete client side application, you can create as many apps via createApp
that your project needs (we recommend using only one at a start), then export
them and you will have them project wide:

```tsx
const shape = {
  users: {
    // no need to inject, we defined it here and it will be shipped with this module
    // many configuration may follow, such as cache tuning, retries...etc etc
    list: api<UserType[], Error, []>({
      producer: async function getUsersList() {
        let promise = await API.get<UserType[]>(`/users`);
        return promise.data
      }
    }),
    findById: api<UserType, Error, [number]>(),
    findUserPosts: api<{ id: string, title: string }, Error, [number]>(),
  }
}

export const {Provider, useApp} = createApp<typeof shape>(shape)
// you can un-reference your shape here!
// shape = null
```

Then, in the users page:

```tsx
export function UsersList() {
  const users = React.use(useApp().users.list());
  return (
    <details open>
      <summary>Users List</summary>
      <div style={{display: "flex", flexDirection: "column"}}>
        <div style={{display: "flex", flexDirection: "column"}}>
          {users.map(u => (
            <Link key={u.id} href={`/users/${u.id}`}>{u.username}</Link>
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

```

And in the user details page, for example:

```tsx

async function getUserDetails(id: number) {
  let promise = await API.get(`/users/${id}`);
  return promise.data
}

export function Component() {
  const app = useApp();
  const {userId} = useParams();

  // inject your function first!
  app.users.findById.inject(getUserDetails);
  const user = React.use(app.users.findById(+userId));

  const rerender = React.useState()[1];
  React.useEffect(() => app.users.findById.subscribe(rerender), [])
  return (
    <Controls>
      <div>
        <details>
          <summary>User {user.username} details</summary>
          <pre>{JSON.stringify(user, null, 4)}</pre>
        </details>
        <Link href={`/users/${userId}/posts`}>see posts</Link>
        {/* ... */}
      </div>
    </Controls>
  );
}

```
