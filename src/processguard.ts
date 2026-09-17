import path from 'path'

interface PluginPackage {
  id: string
  packageName: string
}

interface ProcessGuardApp {
  plugins?: PluginPackage[]
  // every discovered plugin package, known before any of them is loaded
  pluginPackageNames?: string[]
  config: { configPath: string; appPath: string }
  setPluginError: (pluginId: string, message: string) => void
}

export function identifyPluginFromStack(
  stack: string,
  plugins: PluginPackage[]
): string | undefined {
  for (const plugin of plugins) {
    if (stack.includes(plugin.packageName)) {
      return plugin.id
    }
  }
  return undefined
}

let currentApp: ProcessGuardApp | undefined
let installed = false

// The server, its plugins and their libraries share one process, so any of
// them can end it with process.exit(), process.abort() or a signal to its
// own pid. A call whose stack leads back to a plugin package, or to a
// module installed in the plugin directory, is logged and dropped so the
// server keeps running; calls from the server's own code (the admin UI
// restart, a fatal configuration error) pass through.
export function installProcessGuard(app: ProcessGuardApp) {
  currentApp = app
  if (installed) {
    return
  }
  installed = true

  const originalExit = process.exit
  const originalAbort = process.abort
  const originalKill = process.kill

  process.exit = ((code?: number) => {
    if (allowed('exit', `${code ?? ''}`)) {
      originalExit(code)
    }
  }) as typeof process.exit

  process.abort = (() => {
    if (allowed('abort', '')) {
      originalAbort()
    }
  }) as typeof process.abort

  process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
    if (pid !== process.pid || allowed('kill', `${pid}, ${signal}`)) {
      return originalKill(pid, signal)
    }
    return true
  }) as typeof process.kill
}

function allowed(call: string, args: string): boolean {
  const app = currentApp
  if (!app) {
    return true
  }
  const stack = new Error().stack ?? ''
  const pluginId = identifyPluginFromStack(stack, knownPlugins(app))
  if (pluginId) {
    app.setPluginError(pluginId, `Blocked call to process.${call}()`)
  } else if (!isFromPluginModules(app, stack)) {
    return true
  }
  const origin = pluginId
    ? `Plugin ${pluginId}`
    : 'A module installed in the plugin directory'
  console.error(
    `${origin} called process.${call}(${args}); ignored to keep the server running\n${stack}`
  )
  return false
}

// A plugin is registered only after its module has loaded and its
// constructor has run, so during that window it is matched by package
// name alone.
function knownPlugins(app: ProcessGuardApp): PluginPackage[] {
  const loading = (app.pluginPackageNames ?? []).map((packageName) => ({
    id: packageName,
    packageName
  }))
  return [...(app.plugins ?? []), ...loading]
}

// Plugin dependencies are hoisted next to the plugins, so a call from one
// of them carries no plugin package name in its stack. When the server
// runs from the same directory the two cannot be told apart.
function isFromPluginModules(app: ProcessGuardApp, stack: string): boolean {
  const pluginModules = path.join(app.config.configPath, 'node_modules')
  const serverModules = path.join(app.config.appPath, 'node_modules')
  return (
    pluginModules !== serverModules && stack.includes(pluginModules + path.sep)
  )
}
