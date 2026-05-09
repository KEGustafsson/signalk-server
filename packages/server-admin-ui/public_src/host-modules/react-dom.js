const h = globalThis.__SK_REACT_DOM__
if (!h) {
  throw new Error(
    'SignalK host ReactDOM not found on globalThis.__SK_REACT_DOM__. ' +
      'Is this module being loaded outside the admin UI?'
  )
}

export default h.default ?? h
export const version = h.version

export const createPortal = h.createPortal
export const flushSync = h.flushSync

export const preconnect = h.preconnect
export const prefetchDNS = h.prefetchDNS
export const preinit = h.preinit
export const preinitModule = h.preinitModule
export const preload = h.preload
export const preloadModule = h.preloadModule
export const requestFormReset = h.requestFormReset

export const useFormStatus = h.useFormStatus

export const findDOMNode = h.findDOMNode
export const unstable_batchedUpdates = h.unstable_batchedUpdates
