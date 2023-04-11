import * as React from "react";
import {act, render, screen} from "@testing-library/react";
import {api, AppProvider, createApp, useApp} from "../application";
import {flushPromises} from "./testUtils";
import {useImpl} from "../useImpl";

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

describe('useApp', () => {
  it('should "useApp" a promise, suspend and then render the tree', async () => {
    let {useApp, Provider} = createApp<typeof testShape>(testShape)

    function Component() {
      let app = useApp()
      app.users.search.inject(userSearch)
      let data = app.users.search.use("query")
      return <span data-testid="data">{data.name}</span>
    }

    render(
      <React.StrictMode>
        <Provider>
          <React.Suspense fallback={<div data-testid="pending">pending</div>}>
            <Component/>
          </React.Suspense>
        </Provider>
      </React.StrictMode>
    )
    expect(screen.getByTestId("pending").innerHTML).toBe("pending")
    await act(async () => await flushPromises())
    expect(screen.getByTestId("data").innerHTML).toBe("incepter")
  });
  it('should "use" a promise, suspend and then reject', async () => {
    let {Provider} = createApp<typeof testShape>(testShape)
    let error;

    function Component() {
      let app = useApp<typeof testShape>()
      app.users.search.inject(() => Promise.reject(14))
      try {
        let data = app.users.search.use("query")
        return <span data-testid="data">{data.name}</span>
      } catch (e) {
        error = e;
        return null;
      }
    }

    render(
      <React.StrictMode>
        <Provider>
          <Component/>
        </Provider>
      </React.StrictMode>
    )
    await act(async () => await flushPromises())
    expect(error.reason).toEqual(14)
    expect(error.status).toEqual("rejected")
  });
  it('should "useImpl" on a promise, no suspend and then resolve', async () => {
    let cache = new Map()
    let {useApp, app} = createApp<typeof testShape>(testShape, cache)
    let resolvedState;

    function Component() {
      let app = useApp();
      let state = useImpl(app.users.findOne.inject(userSearch)("1"));
      resolvedState = state;
      return <span data-testid="status">{state.status}</span>
    }

    render(
      <React.StrictMode>
        <AppProvider cache={cache} app={app}>
          <Component/>
        </AppProvider>
      </React.StrictMode>
    )

    await act(async () => await flushPromises())
    expect(resolvedState).toEqual({id: 15, name: 'incepter'})
  });
});
