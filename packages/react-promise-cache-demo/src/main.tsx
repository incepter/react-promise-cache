import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import DefaultErrorBoundary from "./app/error-boundary";
import {RouterProvider} from "react-router-dom";
import {router} from "./app/routing";

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DefaultErrorBoundary>
      <React.Suspense fallback="Loading your data">
        <RouterProvider router={router}/>
      </React.Suspense>
    </DefaultErrorBoundary>
  </React.StrictMode>,
)
