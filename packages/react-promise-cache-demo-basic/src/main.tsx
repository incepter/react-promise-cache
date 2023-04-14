import * as React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/routing";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<React.Suspense fallback="Loading your data">
			<RouterProvider router={router} />
		</React.Suspense>
	</React.StrictMode>
);
