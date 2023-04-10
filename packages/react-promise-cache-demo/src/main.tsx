import * as React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import axios from "axios";
import {api, createApp} from "react-promise-cache/src";

let shape = {
  users: {
    search: api<{}, Error, [number]>(),
    reducer: api<{}, Error, [string, number]>()
  }
}

let {Provider, useApp} = createApp<typeof shape>(shape)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider>
      <React.Suspense fallback="Loading your data">
        <NewWorld/>
      </React.Suspense>
    </Provider>
  </React.StrictMode>,
)

async function getUserDetails(id) {
  // @ts-ignore
  let promise = await axios.get(`https://jsonplaceholder.typicode.com/users/${id}`);
  return promise.data
}


let userIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function todosReducer(state, action) {
  console.log('calling with', state, action);
  if (typeof action === "function") {
    return action(state);
  }

  return action;
}

function NewWorld() {
  let [userId, setUserId] = React.useState(1)
  let app = useApp();

  app.users.search.inject(getUserDetails);
  app.users.reducer.inject(todosReducer);

  // @ts-ignore
  let user = React.use(app.users.search(userId)) // can be called conditionally

  // @ts-ignore
  let [oho, dispatch] = React.useReducer(app.users.reducer, {
    data: 0,
    status: "initial"
  })
  console.log('_reducer value', oho)

  let rerender = React.useState()[1]
  React.useEffect(() => {
    return app.users.search.subscribe(rerender)
  }, [app.users.search])

  return (
    <>
      {userIds.map(t => (
        <button key={t}
                onClick={() => React.startTransition(() => setUserId(t))}>
          Load user {t}</button>
      ))}
      <hr/>
      {userIds.map(t => (
        <button key={t}
                onClick={() => React.startTransition(() => app.users.search.evict(t))}>
          Force reload user {t}</button>
      ))}
      <hr/>
      <h2>Counter: {oho.data}</h2>
      <button onClick={() => dispatch((prev => prev.data + 1))}>dispatch in reducer
      </button>
      <hr/>
      <details open>
        <summary>User 1,</summary>
        <pre>{JSON.stringify(user, null, 4)}</pre>
      </details>
    </>
  )
}
