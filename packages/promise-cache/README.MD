# React application cache


## TL;DR

The idea behind this library is that you will be able to cache promises that
you receive from different functions in your application:
```tsx
import {useApp} from "react-promise-cache"

function MyComponent() {
  const app = useApp()
  const {userId} = useParam()
  const promise = app.users.findById(userId)
  
  const data = React.use(promise)
  // do something with data
}
```

In the previous example, `app.users.findById(userId)` will return the same
promise until you change the userId and then you will have a new promise.
