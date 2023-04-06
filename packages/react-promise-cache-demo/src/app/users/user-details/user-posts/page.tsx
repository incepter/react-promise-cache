import {useParams} from "react-router-dom";
import {API} from "../../../api";
import {usePromise} from "react-promise-cache";

export function Component() {
  let {userId} = useParams()
  let currentUser = usePromise(API.get(`/users/${userId}`)).data
  let userPosts = usePromise(API.get(`/users/${userId}/posts`)).data

  return (
    <details open>
      <summary>User {currentUser.username} posts</summary>
      <pre>{JSON.stringify(userPosts, null, 4)}</pre>
    </details>
  );
}
