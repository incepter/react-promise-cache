import * as React from "react";
import { isServer, stringify } from "../utils";
import { State } from "../types";
import { useCache } from "./context";

export function Hydration({ id }: { id: string }) {
	if (!id) {
		throw new Error("Please give a unique id to Hydration!");
	}
	if (!isServer) {
		// todo: spread hydration states, streaming may alter the previous values
		let existingHtml = React.useRef<string | undefined>();
		if (!existingHtml.current) {
			existingHtml.current = document.getElementById(id)?.innerHTML;
		}
		return existingHtml.current ? (
			<script
				id={id}
				dangerouslySetInnerHTML={{
					__html: existingHtml.current,
				}}
			></script>
		) : null;
	}
	let cache = useCache();

	let entries: Record<string, Record<string, State<any, any, any>>> = {};
	for (let { name, calls } of cache.values()) {
		entries[name] = transformForHydratedCallsCache(calls);
	}

	let assignment = `Object.assign(window.__HYDRATED_APP_CACHE__ || {}, ${stringify(
		entries,
		30
	)})`;
	return (
		<script
			id={id}
			dangerouslySetInnerHTML={{
				__html: `window.__HYDRATED_APP_CACHE__ = ${assignment}`,
			}}
		></script>
	);
}

function transformForHydratedCallsCache(
	calls: Map<string, State<any, any, any>>
) {
	return [...calls.entries()].reduce((acc, curr) => {
		if (curr[1].hydrated) {
			return acc;
		}
		let { promise, ...rest } = curr[1];
		curr[1].hydrated = true;
		acc[curr[0]] = rest;
		return acc;
	}, {});
}

export function SuspenseBoundary({
	fallback,
	children,
	id,
}: {
	id: string;
	fallback?: React.ReactNode;
	children?: React.ReactNode;
}) {
	return (
		<React.Suspense fallback={fallback}>
			{children}
			<Hydration id={id} />
		</React.Suspense>
	);
}
