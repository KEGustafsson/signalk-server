import { getPathFromKey } from './pathUtils'

interface SubscriptionMessage {
  context: string
  announceNewPaths?: boolean
  sourcePolicy?: 'preferred' | 'all'
  subscribe?: Array<{ path: string }>
  unsubscribe?: Array<{ path: string }>
}

interface WebSocketLike {
  send: (data: string) => void
  readyState?: number
}

class GranularSubscriptionManager {
  private webSocket: WebSocketLike | null = null
  private ready = false
  private currentPaths: Set<string> = new Set()
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private sourcePolicy: 'preferred' | 'all' = 'preferred'

  private readonly DEBOUNCE_MS = 350
  private readonly SIMILARITY_THRESHOLD = 0.8

  setWebSocket(ws: WebSocketLike | null): void {
    this.webSocket = ws
  }

  setSourcePolicy(policy: 'preferred' | 'all'): void {
    this.sourcePolicy = policy
  }

  startDiscovery(): void {
    if (!this.webSocket) return

    this._send({
      context: '*',
      announceNewPaths: true,
      sourcePolicy: this.sourcePolicy,
      subscribe: []
    })

    this.currentPaths = new Set()
    this.ready = true
  }

  requestPaths(pathKeys: string[], _allPathKeys: string[]): void {
    if (!pathKeys || pathKeys.length === 0) return

    const targetPaths = new Set(pathKeys)

    if (!this.ready) return

    if (this._pathsAreSimilar(this.currentPaths, targetPaths)) return

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this._executeResubscription(targetPaths)
    }, this.DEBOUNCE_MS)
  }

  unsubscribeAll(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.webSocket) {
      try {
        this._send({
          context: '*',
          unsubscribe: [{ path: '*' }]
        })
      } catch {
        // WebSocket may already be closed
      }
    }

    this.currentPaths = new Set()
    this.ready = false
  }

  cancelPending(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  private _executeResubscription(newPaths: Set<string>): void {
    if (!this.webSocket) return

    const uniquePaths = this._extractUniquePaths(newPaths)
    if (uniquePaths.length === 0) {
      this.currentPaths = new Set()
      return
    }

    // Unsubscribe existing paths first — the server accumulates
    // listeners so a new subscribe message does not replace the old one.
    this._send({
      context: '*',
      unsubscribe: [{ path: '*' }]
    })

    this._send({
      context: '*',
      announceNewPaths: true,
      sourcePolicy: this.sourcePolicy,
      subscribe: uniquePaths.map((path) => ({ path }))
    })

    this.currentPaths = newPaths
  }

  private _pathsAreSimilar(
    currentPaths: Set<string>,
    newPaths: Set<string>
  ): boolean {
    if (currentPaths.size === 0 && newPaths.size === 0) return true
    if (currentPaths.size === 0 || newPaths.size === 0) return false

    for (const path of newPaths) {
      if (!currentPaths.has(path)) return false
    }

    let overlap = 0
    for (const path of newPaths) {
      if (currentPaths.has(path)) overlap++
    }

    const overlapPercent = overlap / Math.max(currentPaths.size, newPaths.size)
    return overlapPercent >= this.SIMILARITY_THRESHOLD
  }

  private _extractUniquePaths(path$SourceKeys: Set<string>): string[] {
    const paths = new Set<string>()
    for (const pk of path$SourceKeys) {
      const nullIdx = pk.indexOf('\0')
      const key = nullIdx >= 0 ? pk.slice(nullIdx + 1) : pk
      const path = getPathFromKey(key)
      if (path) {
        paths.add(path)
      }
    }
    return [...paths]
  }

  private _send(msg: SubscriptionMessage): void {
    if (
      this.webSocket &&
      this.webSocket.readyState !== undefined &&
      this.webSocket.readyState === WebSocket.OPEN
    ) {
      this.webSocket.send(JSON.stringify(msg))
    } else if (this.webSocket && this.webSocket.send) {
      try {
        this.webSocket.send(JSON.stringify(msg))
      } catch {
        // WebSocket may not be ready
      }
    }
  }
}

const granularSubscriptionManager = new GranularSubscriptionManager()

export default granularSubscriptionManager
export { GranularSubscriptionManager }
