import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { freeport } from './ts-servertestutilities'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Server = require('../dist/')

interface ProviderStatus {
  id: string
  type: string
  message: string
}

interface TestServer {
  app: {
    config: { settings: { port: number } }
    getProviderStatus: () => ProviderStatus[]
    handleMessage: (id: string, delta: object) => void
  }
  start: () => Promise<unknown>
  stop: () => Promise<unknown>
}

const ERROR_LIMIT = 10

const pressureDelta = {
  updates: [
    { values: [{ path: 'environment.outside.pressure', value: 101325 }] }
  ]
}

const statusOf = (server: TestServer, id: string): ProviderStatus | undefined =>
  server.app.getProviderStatus().find((s: ProviderStatus) => s.id === id)

const waitFor = async (condition: () => boolean) => {
  for (let i = 0; i < 50 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  assert(condition(), 'condition not met in time')
}

describe('Plugin uncaught error limit', () => {
  const configPath = path.join(__dirname, 'plugin-test-config')
  const pluginConfigFile = path.join(
    configPath,
    'plugin-config-data',
    'crashingplugin.json'
  )
  let pluginConfig: string
  let server: TestServer

  before(async () => {
    process.env.SIGNALK_NODE_CONFIG_DIR = configPath
    pluginConfig = fs.readFileSync(pluginConfigFile, 'utf8')
    server = new Server({ config: { settings: { port: await freeport() } } })
    await server.start()
  })

  after(async () => {
    await server.stop()
    // saving the config through the API rewrites the tracked fixture
    fs.writeFileSync(pluginConfigFile, pluginConfig)
  })

  it('stops a plugin that keeps throwing and restarts it when its config is saved', async () => {
    for (let i = 0; i < ERROR_LIMIT - 1; i++) {
      server.app.handleMessage('test', pressureDelta)
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.strictEqual(
      statusOf(server, 'crashingplugin')?.message,
      "Runtime error: Cannot read properties of null (reading 'tendency')"
    )

    server.app.handleMessage('test', pressureDelta)
    await waitFor(() =>
      /^Stopped after/.test(statusOf(server, 'crashingplugin')?.message ?? '')
    )
    assert.strictEqual(
      statusOf(server, 'crashingplugin')?.message,
      "Stopped after 10 uncaught errors within 60 s, last: Runtime error: Cannot read properties of null (reading 'tendency')"
    )

    // the stopped plugin no longer receives deltas, so its status is unchanged
    server.app.handleMessage('test', pressureDelta)
    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.match(
      statusOf(server, 'crashingplugin')?.message ?? '',
      /^Stopped after/
    )

    const response = await fetch(
      `http://localhost:${server.app.config.settings.port}/plugins/crashingplugin/config`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, configuration: {} })
      }
    )
    assert.strictEqual(response.status, 200)
    // the restarted plugin fails again on the delta replayed from the cache,
    // which shows it is running and counting from zero
    await waitFor(
      () =>
        statusOf(server, 'crashingplugin')?.message ===
        "Runtime error: Cannot read properties of null (reading 'tendency')"
    )
  })
})
