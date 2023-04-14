import * as React from "react";
import {useParams} from "react-router-dom";
import {API} from "../../../api";
import {useApi} from "react-promise-cache";

async function getUserPosts(userId: number) {
  let result = await API.get(`/users/${userId}/posts`)
  return result.data
}

export function Component() {
  let {userId} = useParams()

  let userPostsApi = useApi(getUserPosts)
  let currentUserApi = useApi(getUserPosts)

  let userPosts = userPostsApi.use(+userId!)
  let currentUser = currentUserApi.use(+userId!)

  return (
    <details open>
      <summary>User {currentUser.username} posts</summary>
      <pre>{JSON.stringify(userPosts, null, 4)}</pre>
    </details>
  );
}
