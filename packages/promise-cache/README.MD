# React promise cache


## The Api

`react-promise-cache` let you cache promises and their data, it works the same 
way in the client and the server. It uses `react-18` features and will target
the future of react.

## Simple Usage:

```tsx
// Users list
import {useApi} from "react-promise-cache";

async function getUsersList() {
    let promise = await API.get<UserType[]>(`/users`);
    return promise.data
}

function UsersList() {
  const usersList = useApi(getUsersList)
  const data = React.use(usersList())
  // or const data = usersList.use(); (falls back to React.use if existent)
  
  // do something with data
}
```
And using parameters:
```tsx
// User details
async function getUserDetailsList(id: number) {
    let promise = await API.get<UserType>(`/users/${id}`);
    return promise.data
}

function UserDetails({userId}: {userId: number}) {
  const userDetails = useApi(getUserDetailsList)
  
  const data = React.use(userDetails(userId))
  // or const data = userDetails.use(); (falls back to React.use if existent)
  
  // do something with data
}
```

This library uses `react-18` features:
- When the `promise` is `pending`, the component suspends and the nearest
  Suspense fallback will be shown.
- When the `promise` is rejected, it is thrown to the nearest `ErrorBoundary`.

In the previous example, `useApi` will return the same reference for the same
function reference. Ensure to memoize your function, but honestly, you won't 
need since you can use parameters to your function.

## The API
Here is the different parts of the API that the library supports:

### `useApi`
`useApi` is designed to give you an `Api` for your function, this Api has the
following properties:


| Property            | type                                                           | Description                                                                                                     |
|---------------------|----------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| `(...args)`         | `(...args: A extends unknwon[]): State<T, R, A> or Promise<T>` | When it is invoked, it calls your original function and caches the result for further calls                     |
| `use(...args)`      | `use(...args: A extends unknwon[]): T`                         | Uses React.use or shims it to give you the resolved data. Will suspend on pending and throw on error.           |
| `evict(...args)`    | `evict(...args: A extends unknwon[]): Api`                     | Removes the cache related to the given arguments                                                                |
| `subscribe(fn)`     | `subscribe(rerender: (() => void)): (() => void)`              | Will subscribe to state changes and evicts                                                                      |
| `getState(...args)` | `getState(...args: A extends unknwon[]): State<T, R, A>`       | Returns the cached state related to the given arguments                                                         |
| `useState(...args)` | `useState(...args: A extends unknwon[]): State<T, R, A>`       | Returns the cached state and performs subscription to state updates                                             |
| `inject(fn)`        | `inject(fn: ((...args) => T or Promise<T>)): Api`              | To lazily define your functions (supported with the app abstraction), you can inject the actual functions later |

So you can use this API with several React APIs. Either synchronous or async.

Here is a [good example to try out](https://codesandbox.io/s/pedantic-resonance-h4cnrl?file=/src/App.tsx)!

### `AppProvider`
The `provider` is a React Context Provider that you should use to share, cache
and isolate your data.

It is optional in client side, but required in the server.

#### Provider props
| Property   | type                                       | Description                                                |
|------------|--------------------------------------------|------------------------------------------------------------|
| `children` | `React.ReactNode`                          | Your app                                                   |
| `cache?`   | `Map`                                      | The actual cache map to use, it is created if not provided |
| `app?`     | `evict(...args: A extends unknwon[]): Api` | The return of `createApp`                                  |


### `Hydration`
The `Hydration` component is used to save your promises' data from the server
to the client, and boot from it there. It automatically caches the cache
instance in its context, and require a `unique` string ID.

>If you are streaming HTML and have multiple `Suspense` boundaries in your App,
think of adding a Hydration every time you will suspend. Or use `SuspendeBoundary`
from the library (requires `id` as well) that injects a `Suspense` and a 
> `Hydration`, (you can pass the `fallback`).

By [@incepter](https://twitter.com/incepterr), with 💜
