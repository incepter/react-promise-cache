import {useParams} from "react-router-dom";
import * as React from "react";
import {useApi} from "react-promise-cache";
import {getUsersList} from "./users/page";
import {getUserDetails} from "./users/user-details/page";

export default function Controls({children}) {
  let params = useParams()

  let usersApi = useApi(getUserDetails);
  let userDetailsApi = useApi(getUsersList);

  return (
    <div>
      {
        params?.userId && (
          <button onClick={() => {
            usersApi.evict(+params.userId!);
          }}>
            Invalidate user with id {params.userId}'s Cache
          </button>
        )
      }
      <button onClick={() => {
        userDetailsApi.evict();
      }}>
        Invalidate users list cache
      </button>
      <hr/>
      <div>{children}</div>
    </div>
  )
}
