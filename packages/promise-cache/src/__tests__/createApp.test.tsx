import * as React from "react";
import {act, render, screen} from "@testing-library/react";
import {api, createApp} from "../application";
import {Api} from "../types";

type User = {
  id: number,
  name: string,
}

let userSearch = async () => Promise.resolve({id: 15, name: "incepter"})

let testShape = {
  auth: {
    current: api<User, Error, []>({
      producer: userSearch,
    })
  },
  users: {
    search: api<User, Error, [string]>(),
    findOne: api<User, Error, [string]>()
  }
}

describe('createApp tests', () => {
  it('should create the application with correct types', () => {
    let {app} = createApp<typeof testShape>(testShape)
    let authCurrent: Api<User, Error, []> = app.auth.current;
    let searchToken: Api<User, Error, [string]> = app.users.search;
  });

  it('should throw if used without being injected', () => {
    let expectedThrownErrorMessage = "inject your users_search function first"
    let {app, useApp, Provider} = createApp<typeof testShape>(testShape)
    expect(() => app.users.search("query")).toThrow(expectedThrownErrorMessage)
    expect(typeof app).toBe("object")
    expect(typeof useApp).toBe("function")
    expect(typeof Provider).toBe("function")
  });

  it('should not throw when injection did happen', () => {
    let {app} = createApp<typeof testShape>(testShape)

    // should throw because it isn't injected yet
    expect(() => app.users.search("query")).toThrow(
      "inject your users_search function first"
    )
    let spy = jest.fn().mockImplementation(userSearch)
    app.users.search.inject(spy)
    app.users.search("query")
    expect(spy).toHaveBeenCalledWith("query")
  });
  it('should reuse the same function when injecting several times', () => {
    let {app} = createApp<typeof testShape>(testShape)

    let fn = app.users.search.inject(userSearch)
    let fn2 = app.users.search.inject(userSearch)
    expect(fn).toBe(fn2)
  });
});
