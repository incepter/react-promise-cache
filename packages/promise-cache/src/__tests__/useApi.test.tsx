import * as React from "react";
import { act, render, screen } from "@testing-library/react";
import { flushPromises } from "./testUtils";
import { useApi } from "../lib/api";
import { AppProvider } from "../lib/context";

type User = {
	id: number;
	name: string;
};

let userSearch = async () => Promise.resolve({ id: 15, name: "incepter" });

describe("useApi tests", () => {
	it("should call useAPI with use without deps", async () => {
		function Component() {
			let api = useApi(userSearch);
			let data = api.use();
			return <span data-testid="data">{data.name}</span>;
		}
		render(
			<React.StrictMode>
				<AppProvider>
					<React.Suspense fallback={<div data-testid="pending">pending</div>}>
						<Component />
					</React.Suspense>
				</AppProvider>
			</React.StrictMode>
		);
		expect(screen.getByTestId("pending").innerHTML).toBe("pending");
		await act(async () => await flushPromises());
		expect(screen.getByTestId("data").innerHTML).toBe("incepter");
	});
	it("should call useAPI with use, and then evict and rerender again", async () => {
		let spy = jest.fn().mockImplementation(userSearch);
		let savedApi;

		function Component() {
			let api = useApi(spy);
			savedApi = api;
			let data = api.use();

			let rerender = React.useState()[1];
			React.useEffect(() => api.subscribe(rerender), []);

			return <span data-testid="data">{data.name}</span>;
		}
		render(
			<React.StrictMode>
				<AppProvider>
					<React.Suspense fallback={<div data-testid="pending">pending</div>}>
						<Component />
					</React.Suspense>
				</AppProvider>
			</React.StrictMode>
		);
		expect(screen.getByTestId("pending").innerHTML).toBe("pending");
		await act(async () => await flushPromises());
		expect(screen.getByTestId("data").innerHTML).toBe("incepter");

		act(() => {
			React.startTransition(() => {
				savedApi.evict();
			});
		});
		await act(async () => await flushPromises());
		expect(screen.getByTestId("data").innerHTML).toBe("incepter");
	});
});
