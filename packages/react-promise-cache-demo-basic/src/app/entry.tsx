import * as React from 'react'
import "./entry.css"
import {Link, Outlet} from 'react-router-dom';

export function Component() {
  return (
    <div className="App">
      <div className="main">
        <div>
          <nav style={{display: "flex", flexDirection: "column"}}>
            <Link to="users">Users list</Link>
          </nav>
          <hr/>
          <React.Suspense>
            <Outlet/>
          </React.Suspense>
        </div>
      </div>
    </div>
  )
}
