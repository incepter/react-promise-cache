import {useParams} from "react-router-dom";
import * as React from "react";
import {useApp} from "../main";

export default function Controls({children}) {
  let app = useApp()
  let params = useParams()

  return (
    <div>
      {
        params?.userId && (
          <button onClick={() => {
            app.users.findById.evict(+params.userId!);
          }}>
            Invalidate user with id {params.userId}'s Cache
          </button>
        )
      }
      <button onClick={() => {
        app.users.list.evict();
      }}>
        Invalidate users list cache
      </button>
      <hr/>
      <div>{children}</div>
    </div>
  )
}
