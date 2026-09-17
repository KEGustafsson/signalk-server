import { expect } from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { installProcessGuard } from '../dist/processguard'

describe('Process guard', () => {
  let configPath: string
  let errors: string[]
  let consoleError: typeof console.error

  const writeModule = (name: string, body: string) => {
    const dir = path.join(configPath, 'node_modules', name)
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'index.js')
    fs.writeFileSync(file, body)
    delete require.cache[file]
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(file)
  }

  before(() => {
    configPath = fs.mkdtempSync(path.join(os.tmpdir(), 'processguard-'))
    installProcessGuard({
      plugins: [{ id: 'exitingplugin', packageName: 'exitingplugin' }],
      config: { configPath, appPath: path.resolve(__dirname, '..') },
      setPluginError: (pluginId, message) => {
        errors.push(`${pluginId}: ${message}`)
      }
    })
    consoleError = console.error
    console.error = () => {}
  })

  after(() => {
    console.error = consoleError
    fs.rmSync(configPath, { recursive: true, force: true })
  })

  beforeEach(() => {
    errors = []
  })

  it('ignores process.exit() called from a plugin', () => {
    const plugin = writeModule(
      'exitingplugin',
      'module.exports = () => process.exit(3)'
    )
    plugin()
    expect(errors).to.deep.equal([
      'exitingplugin: Blocked call to process.exit()'
    ])
  })

  it('ignores a signal a plugin sends to the server process', () => {
    const plugin = writeModule(
      'exitingplugin',
      "module.exports = () => process.kill(process.pid, 'SIGTERM')"
    )
    plugin()
    expect(errors).to.deep.equal([
      'exitingplugin: Blocked call to process.kill()'
    ])
  })

  it('ignores process.abort() called from a plugin', () => {
    const plugin = writeModule(
      'exitingplugin',
      'module.exports = () => process.abort()'
    )
    plugin()
    expect(errors).to.deep.equal([
      'exitingplugin: Blocked call to process.abort()'
    ])
  })

  it('ignores process.exit() called from a module in the plugin directory', () => {
    const lib = writeModule('somelib', 'module.exports = () => process.exit(1)')
    lib()
    expect(errors).to.deep.equal([])
  })

  it('ignores process.exit() from a plugin that is still loading', () => {
    const appPath = path.resolve(__dirname, '..')
    installProcessGuard({
      plugins: [],
      pluginPackageNames: ['loadingplugin'],
      config: { configPath: appPath, appPath },
      setPluginError: (pluginId, message) => {
        errors.push(`${pluginId}: ${message}`)
      }
    })
    const dir = path.join(configPath, 'loadingplugin')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'index.js')
    fs.writeFileSync(file, 'process.exit(2)')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(file)
    expect(errors).to.deep.equal([
      'loadingplugin: Blocked call to process.exit()'
    ])
  })

  it('lets server code signal the process', () => {
    expect(process.kill(process.pid, 0)).to.equal(true)
  })
})
