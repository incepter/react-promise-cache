export let maybeWindow = typeof window !== "undefined" ? window : undefined;
export let isServer = !maybeWindow ||
  !maybeWindow.document ||
  !maybeWindow.document.createComment;

export function stringify(val, depth) {
  depth = isNaN(+depth) ? 1 : depth;

  function _build(key, val, depth, o?, a?) { // (JSON.stringify() has it's own rules, which we respect here by using it for property iteration)
    return !val || typeof val !== 'object' ? val : (a = Array.isArray(val), JSON.stringify(val, function (
      k, v) {
      if (a || depth > 0) {
        if (!k) return (a = Array.isArray(v), val = v);
        !o && (o = a ? [] : {});
        o[k] = _build(k, v, a ? depth : depth - 1);
      }
    }), o || (a ? [] : {}));
  }

  return JSON.stringify(_build('', val, depth));
}
