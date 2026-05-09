// Served verbatim (lives in publicDir, not Vite-processed). Resolves the
// admin UI's import map entry for `react` to the host's React instance,
// which bootstrap.tsx assigns to window.__SK_REACT__ before render.
const h = globalThis.__SK_REACT__
if (!h) {
  throw new Error(
    'SignalK host React not found on globalThis.__SK_REACT__. ' +
      'Is this module being loaded outside the admin UI?'
  )
}

export default h.default ?? h
export const version = h.version

export const Children = h.Children
export const Fragment = h.Fragment
export const Profiler = h.Profiler
export const StrictMode = h.StrictMode
export const Suspense = h.Suspense

export const cloneElement = h.cloneElement
export const createContext = h.createContext
export const createElement = h.createElement
export const createRef = h.createRef
export const forwardRef = h.forwardRef
export const isValidElement = h.isValidElement
export const lazy = h.lazy
export const memo = h.memo
export const startTransition = h.startTransition
export const act = h.act
export const use = h.use

export const useActionState = h.useActionState
export const useCallback = h.useCallback
export const useContext = h.useContext
export const useDebugValue = h.useDebugValue
export const useDeferredValue = h.useDeferredValue
export const useEffect = h.useEffect
export const useId = h.useId
export const useImperativeHandle = h.useImperativeHandle
export const useInsertionEffect = h.useInsertionEffect
export const useLayoutEffect = h.useLayoutEffect
export const useMemo = h.useMemo
export const useOptimistic = h.useOptimistic
export const useReducer = h.useReducer
export const useRef = h.useRef
export const useState = h.useState
export const useSyncExternalStore = h.useSyncExternalStore
export const useTransition = h.useTransition
