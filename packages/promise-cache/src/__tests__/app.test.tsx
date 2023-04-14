import * as React from "react";
import { act, render, screen } from "@testing-library/react";
import { api, createApp } from "../lib/application";
import { Api } from "../types";
import { expect } from "@jest/globals";

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

describe("createApp abstraction tests", () => {
	it("should return the same promise", () => {
		let { app } = createApp<typeof testShape>(testShape);
		let p1 = app.auth.current();
		for (let i = 0; i < 5; i++) {
			expect(p1).toBe(app.auth.current());
		}
	});
	it("should return a new promise when it is evicted", () => {
		let { app } = createApp<typeof testShape>(testShape);
		let p1 = app.auth.current();
		app.auth.current.evict();
		let p2 = app.auth.current();
		expect(p1).not.toBe(p2);
	});
});
