const h = globalThis.__SK_REACT_JSX_RUNTIME__
if (!h) {
  throw new Error(
    'SignalK host react/jsx-runtime not found on globalThis.__SK_REACT_JSX_RUNTIME__. ' +
      'Is this module being loaded outside the admin UI?'
  )
}

export default h.default ?? h
export const Fragment = h.Fragment
export const jsx = h.jsx
export const jsxs = h.jsxs
export const jsxDEV = h.jsxDEV
