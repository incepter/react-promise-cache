import * as React from "react";
import {useParams} from "react-router-dom";
import {API} from "../../../api";
import {useApp} from "../../../../main";

async function getUserPosts(userId: number) {
  let result = await API.get(`/users/${userId}/posts`)
  return result.data
}

export function Component() {
  let app = useApp()
  let {userId} = useParams()
  // @ts-expect-error React.use isn't typed
  let currentUser = React.use(app.users.findById(+userId!))
  // let currentUser = app.users.findById.use(+userId!)

  // let userPosts = app.users.findUserPosts.inject(getUserPosts).use(+userId!)
  // @ts-expect-error React.use isn't typed
  let userPosts = React.use(app.users.findUserPosts.inject(getUserPosts)(+userId!))

  return (
    <details open>
      <summary>User {currentUser.username} posts</summary>
      <pre>{JSON.stringify(userPosts, null, 4)}</pre>
    </details>
  );
}
