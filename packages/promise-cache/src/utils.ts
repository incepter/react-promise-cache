export let maybeWindow = typeof window !== "undefined" ? window : undefined;
export let isServer = !maybeWindow ||
  !maybeWindow.document ||
  !maybeWindow.document.createComment;
