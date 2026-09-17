import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { freeport } from './ts-servertestutilities'
import {
  MAX_CONSECUTIVE_CRASHES,
  SAFE_MODE_MESSAGE,
  STARTUP_GUARD_FILENAME
} from '../dist/startupguard'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Server = require('../dist/')

interface ProviderStatus {
  id: string
  type: string
  message: string
}

describe('Plugin safe mode', () => {
  const configPath = path.join(__dirname, 'plugin-test-config')
  const stateFile = path.join(configPath, STARTUP_GUARD_FILENAME)

  after(() => {
    fs.rmSync(stateFile, { force: true })
  })

  it('keeps enabled plugins stopped after repeated crashes and recovers on a clean stop', async () => {
    process.env.SIGNALK_NODE_CONFIG_DIR = configPath
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        consecutiveCrashes: MAX_CONSECUTIVE_CRASHES - 1,
        running: true,
        runId: 'previous-process'
      })
    )

    const port = await freeport()
    const server = new Server({
      config: { settings: { port } }
    })
    await server.start()

    assert(server.app.startupGuard.safeMode, 'Server should be in safe mode')
    assert(
      server.app.plugins.length > 0,
      'Plugins should still be registered in safe mode'
    )

    const statuses: ProviderStatus[] = server.app.getProviderStatus()
    const status = statuses.find((s) => s.id === 'crashingplugin')
    assert(status, 'Enabled plugin should report a status')
    assert.strictEqual(status.type, 'error')
    assert.strictEqual(status.message, SAFE_MODE_MESSAGE)

    await server.stop()

    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    assert.deepStrictEqual(state, { consecutiveCrashes: 0, running: false })
  })
})
