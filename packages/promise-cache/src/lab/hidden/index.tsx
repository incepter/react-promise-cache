import * as React from "react";

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

function createOneTimeUseContext() {
  let subscribersIndex = 0
  let subscribers: Map<string, Record<number, (v) => void>> = new Map<string, Record<number, () => void>>()
  let self: Map<string, StateDef<any>> = new Map()
  return {
    get(name) {
      return self.get(name);
    },

    run(name, args) {
      let definition = self.get(name);
      if (!definition) {
        throw new Error(`No state of name ${name}`)
      }
      let pendingPromise = trackPromise(definition.producer(...args));
      definition.promise = pendingPromise

      if (subscribers.has(name)) {
        for (const cb of Object.values(subscribers.get(name)!)) {
          cb(pendingPromise)
        }
      }
    },

    subscribe(name, notify): () => void {
      let definition = self.get(name);
      if (!definition) {
        throw new Error(`No state of name ${name}`)
      }
      let id = ++subscribersIndex
      if (!subscribers.has(name)) {
        subscribers.set(name, {})
      }
      let stateSubs = subscribers.get(name)!;
      stateSubs[id] = notify

      return () => delete stateSubs[id]
    },

    mountState(name, producer, options) {
      let existing = self.get(name)
      if (existing) {
        existing.options = options;
        existing.producer = producer;
        return existing
      }
      let definition = {producer, options};
      self.set(name, definition)

      return self.get(name)!
    },
  }
}

type StateDef<T> = {
  producer,
  options,
  promise?: Promise<T>
}
type MyContextType = {
  run(name, args): void,
  subscribe(name, notify): () => void,
  get<T>(name): StateDef<T> | undefined,
  mountState<T>(name, producer, options): StateDef<T>,
}


export const AsyncStateContext = React.createContext<MyContextType | null>(null)

export function Provider({children}) {
  let ctxValue = React.useMemo(() => createOneTimeUseContext(), [])
  return (
    <AsyncStateContext.Provider value={ctxValue}>
      {children}
    </AsyncStateContext.Provider>
  )
}



function useCurrentContext() {
  return React.useContext(AsyncStateContext)!;
}

export function use<T>(
  name: string,
  producer: () => Promise<T>,
  options?: {args?: any[]}
) {
  console.log('use render')
  let context = useCurrentContext()

  let def = context.mountState(name, producer, options);
  if (!def.promise) {
    context.run(name, options?.args);
  }

  let value = readPromise((def.promise! as OurPromise<any, any>))

  let rerender = React.useState()[1]
  let [state, setState] = React.useState(value)

  if (value !== state) {
    setState(value)
  }

  React.useEffect(() => {
    return context.subscribe(name, (p) => {
      console.log('received notification !', p)
      rerender(p)
    })
  }, [name, context])

  return [state, setState, context!.run.bind(null, name)];
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

function Demo() {
  let [data, run] = use("posts", () => fetch(""), {})
}
