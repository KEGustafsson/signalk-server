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

const statusOf = (server: TestServer, id: string): ProviderStatus | undefined =>
  server.app.getProviderStatus().find((s: ProviderStatus) => s.id === id)

const waitFor = async (condition: () => boolean) => {
  for (let i = 0; i < 50 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  assert(condition(), 'condition not met in time')
}

describe('Plugin hook errors', () => {
  const configPath = path.join(__dirname, 'plugin-test-config')
  const pluginConfigFile = path.join(
    configPath,
    'plugin-config-data',
    'badstopplugin.json'
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

  it('reports a plugin whose registerWithRouter throws', () => {
    const status = statusOf(server, 'badrouterplugin')
    assert.strictEqual(status?.type, 'error')
    assert.strictEqual(
      status?.message,
      'Failed to register routes: router failed'
    )
  })

  it('restarts a plugin whose stop throws when its config is saved', async () => {
    assert.strictEqual(statusOf(server, 'badstopplugin')?.message, 'started 1')

    const response = await fetch(
      `http://localhost:${server.app.config.settings.port}/plugins/badstopplugin/config`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, configuration: {} })
      }
    )
    assert.strictEqual(response.status, 200)
    await waitFor(
      () => statusOf(server, 'badstopplugin')?.message === 'started 2'
    )
  })
})
