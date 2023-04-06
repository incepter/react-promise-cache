import {useParams} from "react-router-dom";
import * as React from "react";
import {evict} from "react-promise-cache";

export default function Controls({children}) {
  let params = useParams()
  let [index, rerender] = React.useState(0)
  console.log("Controls component render with Index value", index)

  return (
    <div>
      <h3>You created {index + 1} different react trees</h3>
      <button onClick={() => rerender(prev => prev + 1)}>Rerender</button>
      {
        params?.userId && (
          <button onClick={() => {
            evict(`/users/${params.userId}`);
            evict(`/users/${params.userId}/posts`);
          }}>
            Invalidate user {params.userId} cache
          </button>
        )
      }
      <hr/>
      <div key={index}>{children}</div>
    </div>
  )
}
