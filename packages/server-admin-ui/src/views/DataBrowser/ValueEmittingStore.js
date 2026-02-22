/**
 * ValueEmittingStore - Generic Signal K value store with per-path subscriptions
 *
 * Stores values by context and path$SourceKey, emitting updates to subscribers.
 * Provides O(1) per-path subscriptions instead of Redux's O(n) selectors.
 *
 * Note: path$SourceKey is a unique identifier combining path and $source,
 * since the same path can have multiple values from different sources.
 */

// Evict non-self contexts that have not received an update in this window.
// Mirrors the server-side deltacache.ts AIS purge cycle.
const CONTEXT_EVICTION_MAX_AGE_MS = 5 * 60 * 1000

class ValueEmittingStore {
  constructor() {
    // Data storage: { context: { path$SourceKey: pathData } }
    this.data = {}
    // Meta storage: { context: { path: metaData } }
    this.meta = {}
    // Per-path listeners: Map<"context:path$SourceKey", Set<callback>>
    this.listeners = new Map()
    // Per-path meta listeners: Map<"meta:context:path", Set<callback>>
    this.metaListeners = new Map()
    // Listeners for structural changes (new paths added)
    this.structureListeners = new Set()
    // Version counter for structural changes
    this.version = 0
    // Last-updated timestamps for non-self contexts (used for eviction)
    this._contextLastUpdated = {}
  }

  /**
   * Evict a single context - removes all stored data, meta, and listeners.
   * Structure listeners are notified so the UI can update.
   */
  _evictContext(context) {
    const paths = Object.keys(this.data[context] || {})
    for (const path$SourceKey of paths) {
      this.listeners.delete(`${context}:${path$SourceKey}`)
    }
    delete this.data[context]
    delete this.meta[context]
    delete this._contextLastUpdated[context]
    this.version++
    this.structureListeners.forEach((callback) => callback(this.version))
  }

  /**
   * Evict non-self contexts that have not received an update within maxAgeMs.
   * Called periodically by the singleton instance.
   */
  _evictStaleContexts(maxAgeMs) {
    const now = Date.now()
    for (const context of Object.keys(this.data)) {
      if (context === 'self') continue
      const lastUpdated = this._contextLastUpdated[context] || 0
      if (now - lastUpdated > maxAgeMs) {
        this._evictContext(context)
      }
    }
  }

  /**
   * Update a single path's data and notify only its subscribers
   */
  updatePath(context, path$SourceKey, pathData) {
    if (!this.data[context]) {
      this.data[context] = {}
    }

    // Track last-update time so _evictStaleContexts knows which contexts are live
    if (context !== 'self') {
      this._contextLastUpdated[context] = Date.now()
    }

    const isNew = !this.data[context][path$SourceKey]
    this.data[context][path$SourceKey] = pathData

    // Notify path-specific listeners
    const key = `${context}:${path$SourceKey}`
    const listeners = this.listeners.get(key)
    if (listeners) {
      listeners.forEach((callback) => callback(pathData))
    }

    // If new path, notify structure listeners
    if (isNew) {
      this.version++
      this.structureListeners.forEach((callback) => callback(this.version))
    }
  }

  /**
   * Update metadata for a path and notify subscribers
   */
  updateMeta(context, path, metaData) {
    if (!this.meta[context]) {
      this.meta[context] = {}
    }
    this.meta[context][path] = { ...this.meta[context][path], ...metaData }

    // Notify meta-specific listeners
    const key = `meta:${context}:${path}`
    const listeners = this.metaListeners.get(key)
    if (listeners) {
      listeners.forEach((callback) => callback(this.meta[context][path]))
    }
  }

  /**
   * Get data for a specific path
   */
  getPathData(context, path$SourceKey) {
    return this.data[context]?.[path$SourceKey]
  }

  /**
   * Get metadata for a path
   */
  getMeta(context, path) {
    return this.meta[context]?.[path]
  }

  /**
   * Get all path keys for a context
   */
  getPath$SourceKeys(context) {
    return Object.keys(this.data[context] || {})
  }

  /**
   * Get all contexts
   */
  getContexts() {
    return Object.keys(this.data)
  }

  /**
   * Subscribe to a specific path - returns unsubscribe function
   */
  subscribe(context, path$SourceKey, callback) {
    const key = `${context}:${path$SourceKey}`
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    this.listeners.get(key).add(callback)

    return () => {
      const listeners = this.listeners.get(key)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.listeners.delete(key)
        }
      }
    }
  }

  /**
   * Subscribe to metadata updates for a path - returns unsubscribe function
   */
  subscribeMeta(context, path, callback) {
    const key = `meta:${context}:${path}`
    if (!this.metaListeners.has(key)) {
      this.metaListeners.set(key, new Set())
    }
    this.metaListeners.get(key).add(callback)

    return () => {
      const listeners = this.metaListeners.get(key)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.metaListeners.delete(key)
        }
      }
    }
  }

  /**
   * Subscribe to structural changes (new paths added)
   */
  subscribeToStructure(callback) {
    this.structureListeners.add(callback)
    return () => this.structureListeners.delete(callback)
  }
}

// Singleton instance
const store = new ValueEmittingStore()

// Periodically remove stale non-self contexts to prevent unbounded memory growth
// from AIS targets that are no longer transmitting.
setInterval(
  () => store._evictStaleContexts(CONTEXT_EVICTION_MAX_AGE_MS),
  CONTEXT_EVICTION_MAX_AGE_MS
)

export default store
export { ValueEmittingStore }
