const h = globalThis.__SK_REACT_DOM_CLIENT__
if (!h) {
  throw new Error(
    'SignalK host react-dom/client not found on globalThis.__SK_REACT_DOM_CLIENT__. ' +
      'Is this module being loaded outside the admin UI?'
  )
}

export default h.default ?? h
export const createRoot = h.createRoot
export const hydrateRoot = h.hydrateRoot
