import * as React from "react";

// @ts-ignore
// export const useImpl = useShim;
export const useImpl = typeof React.use === "function" ? React.use : useShim;

function useShim<T, R>(promise: Promise<T>) {
	const thenable = promise as TrackedThenable<T>;
	switch (thenable.status) {
		case "fulfilled": {
			return (thenable as FulfilledThenable<T>).value;
		}
		case "rejected": {
			throw (thenable as RejectedThenable<T, R>).reason;
		}
		default: {
			if (typeof thenable.status !== "string") {
				const pendingThenable = thenable as PendingThenable<T>;
				pendingThenable.status = "pending";
				pendingThenable.then(
					(fulfilledValue) => {
						if (thenable.status === "pending") {
							const fulfilledThenable = thenable as FulfilledThenable<T>;
							fulfilledThenable.status = "fulfilled";
							fulfilledThenable.value = fulfilledValue;
						}
					},
					(error: R) => {
						if (thenable.status === "pending") {
							const rejectedThenable = thenable as RejectedThenable<T, R>;
							rejectedThenable.status = "rejected";
							rejectedThenable.reason = error;
						}
					}
				);

				switch (thenable.status) {
					case "fulfilled": {
						return (thenable as FulfilledThenable<T>).value;
					}
					case "rejected": {
						throw (thenable as RejectedThenable<T, R>).reason;
					}
				}
			}
		}
	}
	throw thenable;
}

interface TrackedThenable<T> extends Promise<T> {
	status: "pending" | "fulfilled" | "rejected";
}

interface PendingThenable<T> extends Promise<T> {
	status: "pending";
}

interface FulfilledThenable<T> extends Promise<T> {
	status: "fulfilled";
	value: T;
}

interface RejectedThenable<T, R> extends Promise<T> {
	status: "rejected";
	reason: R;
}
