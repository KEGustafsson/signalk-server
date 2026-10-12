/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

// vitest 4 declares the `Assertion` interface inside the `@vitest/expect`
// module (re-exported from `vitest`). jest-dom still augments `vitest`, so its
// matchers no longer merge. Re-augment the interface where vitest defines it,
// matching its `<T = any>` signature so the declarations merge.
declare module '@vitest/expect' {
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<
    any,
    any
  > {}
}
