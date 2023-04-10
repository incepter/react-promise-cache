import * as React from "react";


export type Result<T> = {
  value: T,
  run(): void,
}

interface PendingPromise extends Promise<never> {
  status: "pending"
}

interface SuccessPromise<T> extends Promise<T>  {
  status: "fulfilled",
  value: T,
}

interface ErrorPromise<T, E> extends Promise<T> {
  status: "rejected",
  reason: E,
}

type OurPromise<T, E> = PendingPromise | SuccessPromise<T> | ErrorPromise<T, E>

export function use<T, E = Error>(
  create: () => Promise<T>,
): Result<T> {
  let [promise, setPromise] = React.useState<OurPromise<T, E>>(initialize);

  return {
    value: readPromise(promise),
    run() {
      let promise = create()
      if ((promise as OurPromise<T, E>).status) { // already tracked
        setPromise(promise as OurPromise<T, E>)
      } else {
        setPromise(trackPromise(create()))
      }
    },
  }
  function initialize(): OurPromise<T, E> {
    return trackPromise(create())
  }
}

function readPromise<T, E>(promise: OurPromise<T, E>) {
  if (promise.status === 'fulfilled') {
    return promise.value;
  } else if (promise.status === 'rejected') {
    throw promise.reason;
  } else if (promise.status === 'pending') {
    throw promise;
  } else {
    throw new Error('Illegal State')
  }
}

function trackPromise<T, E>(initialPromise: Promise<T>): OurPromise<T, E> {
  let promise = initialPromise as OurPromise<T, E>;
  promise.status = 'pending';
  promise.then(
    result => {
      promise.status = 'fulfilled';
      (promise as SuccessPromise<T>).value = result;
    },
    reason => {
      promise.status = 'rejected';
      (promise as ErrorPromise<T, E>).reason = reason;
    },
  );
  return promise;
}
