import * as React from "react";
import {render, screen, act} from "@testing-library/react";
import {Hydration, SuspenseBoundary} from "../lib/hydration";
import {useApi} from "../lib/api";
import {AppProvider} from "../lib/context";
import {flushPromises} from "./testUtils";
import TestErrorBoundary from "./err-boundary";

jest.mock("../utils", () => {
  return {
    ...jest.requireActual("../utils"),
    isServer: true,
  }
})
describe('should hydrate correctly all cache', () => {
  it('should require the id prop', async () => {
    const originalConsoleError = console.error;
    console.error = () => {}
    expect(() => render(
      <React.StrictMode>
        {/* @ts-expect-error */}
        <Hydration />
      </React.StrictMode>
    )).toThrow("Please give a unique id to Hydration!");

    console.error = originalConsoleError
  });
  it('should throw when you forget provider in the server', async () => {
    const fn = (id) => Promise.resolve(id);

    let error;
    function Component() {
      try {
        const data = useApi(fn).use(1);
      } catch (e) {
        error = e;
      }
      return null;
    }

    render(
      <React.StrictMode>
        <TestErrorBoundary>
          <Component/>
        </TestErrorBoundary>
      </React.StrictMode>
    );
    expect(error.toString())
      .toBe("Error: You cannot work without context, or use your own cache.")

  });
  it('should perform basic hydration', async () => {
    const fn = (id) => Promise.resolve(id);
    const fn2 = (id) => Promise.resolve(id);

    function Component() {
      const data = useApi(fn).use(1);
      return null;
    }
    function Component2() {
      const data = useApi(fn).use(2);
      return null;
    }
    function Component3() {
      const data = useApi(fn2).use(2);
      return null;
    }

    function Test() {
      return (
        <AppProvider>
          <div data-testid="parent">
            <SuspenseBoundary id="test">
              <Component/>
              <Component2/>
              <Component3/>
            </SuspenseBoundary>
          </div>
        </AppProvider>
      );
    }

    render(
      <React.StrictMode>
        <Test/>
      </React.StrictMode>
    )
    await act(async () => await flushPromises());
    expect(screen.getByTestId("parent").innerHTML).toEqual(
      '<script id="test">window.__HYDRATED_APP_CACHE__ = Object.assign(window.__HYDRATED_APP_CACHE__ || {}, {"fn":{"[1]":{"data":1,"args":[1],"status":"fulfilled"},"[2]":{"data":2,"args":[2],"status":"fulfilled"}},"fn2":{"[2]":{"data":2,"args":[2],"status":"fulfilled"}}})</script>');
  });
});
