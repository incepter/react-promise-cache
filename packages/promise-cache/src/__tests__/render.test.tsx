import * as React from "react";
import { act, render, screen } from "@testing-library/react";
import { api, createApp } from "../deprecated/application";
import { flushPromises } from "./testUtils";
import { useImpl } from "../useImpl";

type User = {
	id: number;
	name: string;
};

let userSearch = async () => Promise.resolve({ id: 15, name: "incepter" });

let testShape = {
	auth: {
		current: api<User, Error, []>({
			producer: userSearch,
		}),
	},
	users: {
		search: api<User, Error, [string]>(),
		findOne: api<User, Error, [string]>(),
	},
};

describe("createApplication abstraction tests", () => {
	it('should "use" a promise, suspend and then render the tree', async () => {
		let { app } = createApp<typeof testShape>(testShape);
		app.users.search.inject(userSearch);

		function Component() {
			let data = app.users.search.use("query");
			return <span data-testid="data">{data.name}</span>;
		}

		render(
			<React.StrictMode>
				<React.Suspense fallback={<div data-testid="pending">pending</div>}>
					<Component />
				</React.Suspense>
			</React.StrictMode>
		);
		expect(screen.getByTestId("pending").innerHTML).toBe("pending");
		await act(async () => await flushPromises());
		expect(screen.getByTestId("data").innerHTML).toBe("incepter");
	});
	it('should "use" a promise, suspend and then reject', async () => {
		let { app } = createApp<typeof testShape>(testShape);
		app.users.search.inject(() => Promise.reject(14));

		let error;

		function Component() {
			try {
				let data = app.users.search.use("query");
				return <span data-testid="data">{data.name}</span>;
			} catch (e) {
				error = e;
				return null;
			}
		}

		render(
			<React.StrictMode>
				<Component />
			</React.StrictMode>
		);
		await act(async () => await flushPromises());
		expect(error.reason).toEqual(14);
		expect(error.status).toEqual("rejected");
	});
	it('should "useImpl" on a promise, no suspend and then resolve', async () => {
		let { app } = createApp<typeof testShape>(testShape);
		let resolvedState;
		function Component() {
			let state = useImpl(app.users.findOne.inject(userSearch)("1"));
			resolvedState = state;
			return <span data-testid="status">{state.status}</span>;
		}

		render(
			<React.StrictMode>
				<Component />
			</React.StrictMode>
		);

		await act(async () => await flushPromises());
		expect(resolvedState).toEqual({ id: 15, name: "incepter" });
	});
});
