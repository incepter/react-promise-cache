import * as React from "react";
import {act, render, screen} from "@testing-library/react";
import {flushPromises} from "./testUtils";
import {getOrCreateApi, useApi} from "../lib/api";
import {AppProvider} from "../lib/context";
import {fireEvent} from "@testing-library/dom";
import TestErrorBoundary from "./err-boundary";

let userSearch = async () => Promise.resolve({id: 15, name: "incepter"});

describe("useApi tests", () => {
  it("should call useAPI with basic async form", async () => {
    function Component() {
      let api = useApi(userSearch);
      let data = api.use();
      return <span data-testid="data">{data.name}</span>;
    }

    render(
      <React.StrictMode>
        <AppProvider>
          <React.Suspense fallback={<div data-testid="pending">pending</div>}>
            <Component/>
          </React.Suspense>
        </AppProvider>
      </React.StrictMode>
    );
    expect(screen.getByTestId("pending").innerHTML).toBe("pending");
    await act(async () => await flushPromises());
    expect(screen.getByTestId("data").innerHTML).toBe("incepter");
  });
  it("should call useAPI with basic sync form", async () => {
    const syncStuff = (id: number) => id;

    function Component() {
      let api = useApi(syncStuff);
      let data = api.useState(14);
      // @ts-ignore
      return <span data-testid="data">{data.data}</span>;
    }

    render(
      <React.StrictMode>
        <AppProvider>
          <Component/>
        </AppProvider>
      </React.StrictMode>
    );
    await act(async () => await flushPromises());
    expect(screen.getByTestId("data").innerHTML).toBe("14");
  });
  it("should call useAPI and treat a rejection", async () => {
    const originalConsoleError = console.error;
    console.error = () => {
    }
    const rejection = (reason) => Promise.reject(reason);

    function Component() {
      let api = useApi(rejection);
      let data = api.use("testing");
      return <span data-testid="data">{data}</span>;
    }

    render(
      <React.StrictMode>
        <AppProvider>
          <TestErrorBoundary>
            <React.Suspense fallback={<div data-testid="pending">pending</div>}>
              <Component/>
            </React.Suspense>
          </TestErrorBoundary>
        </AppProvider>
      </React.StrictMode>
    );
    expect(screen.getByTestId("pending").innerHTML).toBe("pending");
    await act(async () => await flushPromises());
    expect(screen.getByTestId("error-boundary").innerHTML).toBe("testing");
    console.error = originalConsoleError;
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
            <Component/>
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
  it("should get the same api reference and manipulate same state", async () => {
    let api, api2, data, data2;

    function Component() {
      api = useApi(userSearch);
      api2 = useApi(userSearch);
      data = api.use();
      data2 = api2.use();
      return null;
    }

    render(
      <React.StrictMode>
        <React.Suspense fallback={<div data-testid="pending">pending</div>}>
          <Component/>
        </React.Suspense>
      </React.StrictMode>
    );
    await act(async () => await flushPromises());
    expect(data).toBe(data2);
    expect(api).toBe(api2);
  });
  it("should not react to changes to the same api from other components," +
    " because it isn't subscribing", async () => {
    function testFn(arg: string) {
      return Promise.resolve(arg);
    }

    const spy = jest.fn().mockImplementation(testFn);

    function Component() {
      let api = useApi(spy);
      let data = api.use("component - 1");
      return <span data-testid="component1">{data}</span>
    }

    function Component2() {
      let api = useApi(spy);
      let rerender = React.useState({})[1];
      return (
        <div>
          <button data-testid="rerender"
                  onClick={() => rerender({})}>Go
          </button>
          <button data-testid="test"
                  onClick={() => api.evict("component - 1")}>Go
          </button>
        </div>
      )
    }

    render(
      <React.StrictMode>
        <React.Suspense fallback={<div data-testid="pending">pending</div>}>
          <Component/>
          <Component2/>
        </React.Suspense>
      </React.StrictMode>
    );

    await act(async () => await flushPromises());

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("component - 1");
    expect(screen.getByTestId("component1").innerHTML).toBe("component - 1");

    spy.mockClear();
    fireEvent.click(screen.getByTestId("rerender"));

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByTestId("component1").innerHTML).toBe("component - 1");

    spy.mockClear();
    fireEvent.click(screen.getByTestId("test"));

    await act(async () => await flushPromises());

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByTestId("component1").innerHTML).toBe("component - 1");
  });
  it("should not react to changes to the same api from other components," +
    " because it isn't subscribing and using getState only", async () => {
    function testFn(arg: string) {
      return Promise.resolve(arg);
    }

    const spy = jest.fn().mockImplementation(testFn);

    function Component() {
      let api = useApi(spy);
      let data = api.getState("component - 1");
      if (data.status === "pending") {
        throw data.promise;
      }
      if (data.status === "rejected") {
        throw data.data;
      }
      return <span data-testid="component1">{data.data}</span>
    }

    function Component2() {
      let api = useApi(spy);
      let rerender = React.useState({})[1];
      return (
        <div>
          <button data-testid="rerender"
                  onClick={() => rerender({})}>Go
          </button>
          <button data-testid="test"
                  onClick={() => api.evict("component - 1")}>Go
          </button>
        </div>
      )
    }

    render(
      <React.StrictMode>
        <React.Suspense fallback={<div data-testid="pending">pending</div>}>
          <Component/>
          <Component2/>
        </React.Suspense>
      </React.StrictMode>
    );

    await act(async () => await flushPromises());

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("component - 1");
    expect(screen.getByTestId("component1").innerHTML).toBe("component - 1");

    spy.mockClear();
    fireEvent.click(screen.getByTestId("rerender"));

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByTestId("component1").innerHTML).toBe("component - 1");

    spy.mockClear();
    fireEvent.click(screen.getByTestId("test"));

    await act(async () => await flushPromises());

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByTestId("component1").innerHTML).toBe("component - 1");
  });
  it("should react to changes to the same api from other components," +
    " when subscribing", async () => {
    function testFn(arg: string) {
      return Promise.resolve(arg);
    }

    const spy = jest.fn().mockImplementation(testFn);

    function Component() {
      let api = useApi(spy);
      let data = api.use("component - 1");
      let rerender = React.useState({})[1];
      React.useEffect(() => api.subscribe(rerender), [api]);

      return <span data-testid="component1">{data}</span>
    }

    function Component2() {
      let api = useApi(spy);
      let rerender = React.useState({})[1];
      return (
        <div>
          <button data-testid="rerender"
                  onClick={() => rerender({})}>Go
          </button>
          <button data-testid="test"
                  onClick={() => api.evict("component - 1")}>Go
          </button>
        </div>
      )
    }

    render(
      <React.StrictMode>
        <React.Suspense fallback={<div data-testid="pending">pending</div>}>
          <Component/>
          <Component2/>
        </React.Suspense>
      </React.StrictMode>
    );

    await act(async () => await flushPromises());

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("component - 1");
    expect(screen.getByTestId("component1").innerHTML).toBe("component - 1");

    spy.mockClear();
    fireEvent.click(screen.getByTestId("rerender"));

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByTestId("component1").innerHTML).toBe("component - 1");

    spy.mockClear();
    fireEvent.click(screen.getByTestId("test"));

    await act(async () => await flushPromises());

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("component - 1");
    expect(screen.getByTestId("component1").innerHTML).toBe("component - 1");
  });
  it("should react to changes to the same api from other components," +
    " when subscribing via useState and created by createApi", async () => {
    function testFn(arg: string) {
      return Promise.resolve(arg);
    }

    const spy = jest.fn().mockImplementation(testFn);
    const cache = new Map();

    function Component() {
      let api = getOrCreateApi(spy, cache, {name: "test"});
      let data = api.useState("component - 1");

      if (data.status === "pending") {
        throw data.promise;
      }
      if (data.status === "rejected") {
        throw data.data;
      }

      return <span data-testid="component1">{data.data}</span>
    }

    function Component2() {
      let api = getOrCreateApi(spy, cache, {name: "test"});
      let rerender = React.useState({})[1];
      return (
        <div>
          <button data-testid="rerender"
                  onClick={() => rerender({})}>Go
          </button>
          <button data-testid="test"
                  onClick={() => api.evict("component - 1")}>Go
          </button>
        </div>
      )
    }

    render(
      <React.StrictMode>
        <React.Suspense fallback={<div data-testid="pending">pending</div>}>
          <Component/>
          <Component2/>
        </React.Suspense>
      </React.StrictMode>
    );

    await act(async () => await flushPromises());

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("component - 1");
    expect(screen.getByTestId("component1").innerHTML).toBe("component - 1");

    spy.mockClear();
    fireEvent.click(screen.getByTestId("rerender"));

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByTestId("component1").innerHTML).toBe("component - 1");

    spy.mockClear();
    fireEvent.click(screen.getByTestId("test"));

    await act(async () => await flushPromises());

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("component - 1");
    expect(screen.getByTestId("component1").innerHTML).toBe("component - 1");
  });
});
