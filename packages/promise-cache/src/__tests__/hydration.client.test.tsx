import * as React from "react";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {SuspenseBoundary} from "../lib/Hydration";
import {useApi} from "../lib/api";
import {flushPromises} from "./testUtils";
import {beforeEach} from "@jest/globals";
import TestErrorBoundary from "./err-boundary";

jest.mock("../utils", () => {
  return {
    ...jest.requireActual("../utils"),
    isServer: false,
  }
})

function BootHydration({data, shouldEval = true}: {
  data: string,
  shouldEval?: boolean,
}) {
  if (shouldEval) {
    eval(data)
  }
  // return null
  // return JSON.stringify(window.__ASYNC_STATES_HYDRATION_DATA__ ?? {}) as string
  // for some reason, <script> won't affect window
  return <script dangerouslySetInnerHTML={{__html: data}}></script>
}

describe('should hydrate async states', () => {
  beforeEach(() => {
    delete window.__HYDRATED_APP_CACHE__
  })
  it('should boot correctly from hydration and ignore stuff', async () => {
    const originalConsoleError = console.error;
    console.error = () => {}

    let hydrationScript = 'window.__HYDRATED_APP_CACHE__ = Object.assign(window.__HYDRATED_APP_CACHE__ || {}, {"fn":{"[1]":{"data":1,"args":[1],"status":"fulfilled"},"[2]":{"data":2,"args":[2],"status":"rejected"}},"fn2":{"[2]":{"data":2,"args":[2],"status":"fulfilled"}}})'
    const fn = (id) => Promise.resolve(8787);
    const fn2 = (id) => Promise.resolve(9898);

    function Component() {
      const data = useApi(fn).use(1);
      return <span data-testid="1">{data}</span>;
    }
    function Component2() {
      const data = useApi(fn).use(2);
      return <span data-testid="2">{data}</span>;
    }
    function Component3() {
      const data = useApi(fn2).use(2);
      return <span data-testid="3">{data}</span>;
    }
    function Test() {
      return (
        <div data-testid="parent">
          <SuspenseBoundary id="test">
            <BootHydration data={hydrationScript}/>
            <Component/>
            <TestErrorBoundary>
              <Component2/>
            </TestErrorBoundary>
            <Component3/>
          </SuspenseBoundary>
        </div>
      );
    }

    // when
    render(
      <React.StrictMode>
        <Test/>
      </React.StrictMode>
    )

    await act(async () => await flushPromises());
    expect(screen.getByTestId("1").innerHTML).toBe("1");
    expect(screen.getByTestId("error-boundary").innerHTML).toBe("2");
    expect(screen.getByTestId("3").innerHTML).toBe("2");
    console.error = originalConsoleError;
  });
  it('should not boot from hydration when it is not present for its id', async () => {
    // given
    let hydrationScript = 'window.__HYDRATED_APP_CACHE__ = Object.assign(window.__HYDRATED_APP_CACHE__ || {}, {"fn":{"[1]":{"data":1,"args":[1],"status":"fulfilled"},"[2]":{"data":2,"args":[2],"status":"fulfilled"}},"fn2":{"[2]":{"data":2,"args":[2],"status":"fulfilled"}}})'
    const fn = (id) => Promise.resolve(8787);

    function Component() {
      const data = useApi(fn).use(1);
      return <span data-testid="1">{data}</span>;
    }
    function Test() {
      return (
        <div data-testid="parent">
          <SuspenseBoundary id="another-id">
            <BootHydration shouldEval={false} data={hydrationScript}/>
            <Component/>
          </SuspenseBoundary>
        </div>
      );
    }

    // when
    render(
      <React.StrictMode>
        <Test/>
      </React.StrictMode>
    )

    await act(async () => await flushPromises());
    expect(screen.getByTestId("1").innerHTML).toBe("8787");
  });
  it('should rehydrate due to some streaming html event', async () => {
    // given
    let hydrationScript = 'window.__HYDRATED_APP_CACHE__ = Object.assign(window.__HYDRATED_APP_CACHE__ || {}, {"fn":{"[1]":{"data":1,"args":[1],"status":"fulfilled"},"[2]":{"data":2,"args":[2],"status":"fulfilled"}},"fn2":{"[2]":{"data":2,"args":[2],"status":"fulfilled"}}})'
    const fn = (id) => Promise.resolve(8787);

    function Component() {
      let api = useApi(fn);
      const data = api.use(1);

      let rerender = React.useState({})[1];
      React.useEffect(() => api.subscribe(rerender), [api]);
      return <span data-testid="1">{data}</span>;
    }

    function Wrapper({children}) {
      let [visible, setVisible] = React.useState(false)
      return (
        <>
          <button onClick={() => setVisible(true)} data-testid="toggle">toggle
          </button>
          {visible && children}
        </>
      )
    }

    function Test() {
      return (
        <div data-testid="parent">
          <SuspenseBoundary id="test">
            <BootHydration data={hydrationScript}/>
            <Component />
            <Wrapper>
              <SuspenseBoundary id="test2">
                <BootHydration data='window.__HYDRATED_APP_CACHE__ = Object.assign(window.__HYDRATED_APP_CACHE__ || {}, {"fn":{"[1]":{"data":20,"args":[2],"status":"fulfilled"}}})'/>
              </SuspenseBoundary>
            </Wrapper>
          </SuspenseBoundary>
        </div>
      );
    }

    // when
    render(
      <React.StrictMode>
        <Test/>
      </React.StrictMode>
    );

    await act(async () => await flushPromises());
    expect(screen.getByTestId("1").innerHTML).toBe("1");

    fireEvent.click(screen.getByTestId("toggle"));

    await act(async () => await flushPromises());
    expect(screen.getByTestId("1").innerHTML).toBe("20");
  });
});
