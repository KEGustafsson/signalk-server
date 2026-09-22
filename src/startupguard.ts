import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { createDebug } from './debug'

const debug = createDebug('signalk-server:startupguard')

export const STARTUP_GUARD_FILENAME = 'startup-guard.json'
export const MAX_CONSECUTIVE_CRASHES = 3
export const STABLE_UPTIME_MS = 60_000
export const SIGNAL_GRACE_MS = 10_000
export const SAFE_MODE_MESSAGE = `Not started: server is in safe mode after ${MAX_CONSECUTIVE_CRASHES} consecutive crashes during startup. Check the server log, disable the plugin causing the crash, then restart the server.`

interface StartupGuardState {
  consecutiveCrashes: number
  // true while a process that started with this state has neither run
  // stably nor shut down cleanly; a later start that finds it true knows
  // the previous process crashed
  running: boolean
  runId?: string
}

const processRunId = randomUUID()
const activeGuards = new Set<StartupGuard>()
let processHandlersInstalled = false

// A plugin runs inside the server process, so it can take the whole
// process down in ways an uncaughtException handler cannot catch (calling
// process.exit, crashing a native module, exhausting memory). Under a
// supervisor that restarts the server that becomes a reboot loop, with
// the admin UI never up long enough to disable the plugin. The guard
// persists a start marker across process restarts and, after
// MAX_CONSECUTIVE_CRASHES starts that never reached STABLE_UPTIME_MS,
// asks the plugin loader to keep every plugin stopped for that run.
export class StartupGuard {
  private readonly filePath: string
  private crashes = 0

  constructor(configPath: string) {
    this.filePath = path.join(configPath, STARTUP_GUARD_FILENAME)
  }

  get safeMode(): boolean {
    return this.crashes >= MAX_CONSECUTIVE_CRASHES
  }

  get consecutiveCrashes(): number {
    return this.crashes
  }

  begin(): void {
    activeGuards.add(this)
    installProcessHandlers()
    const previous = this.read()
    if (previous?.running && previous.runId === processRunId) {
      this.crashes = previous.consecutiveCrashes
      return
    }
    this.crashes = previous?.running ? previous.consecutiveCrashes + 1 : 0
    this.write({
      consecutiveCrashes: this.crashes,
      running: true,
      runId: processRunId
    })
  }

  markStable(): void {
    activeGuards.delete(this)
    this.write({ consecutiveCrashes: 0, running: false })
  }

  private read(): StartupGuardState | undefined {
    try {
      const state = JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
      if (isStartupGuardState(state)) {
        return state
      }
    } catch (err: unknown) {
      debug.enabled && debug(`No usable ${this.filePath}: ${err}`)
    }
    return undefined
  }

  private write(state: StartupGuardState): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2))
    } catch (err: unknown) {
      console.error(`Could not write ${this.filePath}: ${err}`)
    }
  }
}

function isStartupGuardState(state: unknown): state is StartupGuardState {
  if (typeof state !== 'object' || state === null) {
    return false
  }
  const { consecutiveCrashes, running, runId } =
    state as Partial<StartupGuardState>
  return (
    Number.isInteger(consecutiveCrashes) &&
    (consecutiveCrashes as number) >= 0 &&
    typeof running === 'boolean' &&
    (runId === undefined || typeof runId === 'string')
  )
}

function markAllStable() {
  for (const guard of activeGuards) {
    guard.markStable()
  }
}

// A supervisor stop (SIGTERM) or a Ctrl-C must not count as a crash, and
// neither must a normal exit such as the admin UI restart. The signal
// handlers re-raise the signal after recording the clean stop so the
// process still dies the way it would without them. Other listeners (an
// embedding host's graceful shutdown, a plugin's cleanup) receive the
// re-raised signal first; if they keep the process alive, the default
// action is forced once the grace period is over so a plugin cannot
// hold up a supervisor stop.
function installProcessHandlers() {
  if (processHandlersInstalled) {
    return
  }
  processHandlersInstalled = true

  process.on('exit', (code) => {
    if (code === 0) {
      markAllStable()
    }
  })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    const onSignal = () => {
      markAllStable()
      process.off(signal, onSignal)
      setTimeout(() => {
        process.removeAllListeners(signal)
        process.kill(process.pid, signal)
      }, SIGNAL_GRACE_MS).unref()
      process.kill(process.pid, signal)
    }
    process.on(signal, onSignal)
  }
}
