import * as React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import {RouterProvider} from "react-router-dom"
import {api, createApp} from "react-promise-cache";
import {router} from "./app/routing";
import {API} from "./app/api";
import {UserType} from "./app/users/types";

let shape = {
  users: {
    list: api<UserType[], Error, []>({
      producer: async function getUsersList() {
        // await new Promise(res => setTimeout(res, 20000))
        let promise = await API.get<UserType[]>(`/users`);
        return promise.data
      }
    }),
    findById: api<UserType, Error, [number]>(),
    findUserPosts: api<{ id: string, title: string }, Error, [number]>(),
  }
}

export let {Provider, useApp, app} = createApp<typeof shape>(shape)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider>
      <React.Suspense fallback="___________________________________Loading your data">
        <RouterProvider router={router}/>
      </React.Suspense>
    </Provider>
  </React.StrictMode>,
)
