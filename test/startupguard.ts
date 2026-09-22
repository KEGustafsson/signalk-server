import { expect } from 'chai'
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  MAX_CONSECUTIVE_CRASHES,
  SIGNAL_GRACE_MS,
  STARTUP_GUARD_FILENAME,
  StartupGuard
} from '../dist/startupguard'

describe('StartupGuard', () => {
  let configPath: string
  let stateFile: string
  let guards: StartupGuard[]

  const startGuard = () => {
    const guard = new StartupGuard(configPath)
    guard.begin()
    guards.push(guard)
    return guard
  }
  const readState = () => JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  const writeState = (state: object) =>
    fs.writeFileSync(stateFile, JSON.stringify(state))
  const crashedProcessState = (consecutiveCrashes: number) => ({
    consecutiveCrashes,
    running: true,
    runId: 'previous-process'
  })

  beforeEach(() => {
    configPath = fs.mkdtempSync(path.join(os.tmpdir(), 'startupguard-'))
    stateFile = path.join(configPath, STARTUP_GUARD_FILENAME)
    guards = []
  })

  afterEach(() => {
    // the process exit hook would otherwise write into the removed directory
    guards.forEach((guard) => guard.markStable())
    fs.rmSync(configPath, { recursive: true, force: true })
  })

  it('starts normally when there is no previous state', () => {
    const guard = startGuard()
    expect(guard.safeMode).to.equal(false)
    expect(guard.consecutiveCrashes).to.equal(0)
    expect(readState().running).to.equal(true)
  })

  it('counts a previous process that never became stable as a crash', () => {
    writeState(crashedProcessState(0))
    const guard = startGuard()
    expect(guard.consecutiveCrashes).to.equal(1)
    expect(guard.safeMode).to.equal(false)
  })

  it('enters safe mode after the crash limit is reached', () => {
    writeState(crashedProcessState(MAX_CONSECUTIVE_CRASHES - 1))
    const guard = startGuard()
    expect(guard.consecutiveCrashes).to.equal(MAX_CONSECUTIVE_CRASHES)
    expect(guard.safeMode).to.equal(true)
  })

  it('starts normally after a previous process ran stably', () => {
    writeState({ consecutiveCrashes: 0, running: false })
    const guard = startGuard()
    expect(guard.consecutiveCrashes).to.equal(0)
  })

  it('does not count a restart within the same process', () => {
    writeState(crashedProcessState(1))
    const first = startGuard()
    const second = startGuard()
    expect(first.consecutiveCrashes).to.equal(2)
    expect(second.consecutiveCrashes).to.equal(2)
  })

  it('resets the crash count when marked stable', () => {
    writeState(crashedProcessState(MAX_CONSECUTIVE_CRASHES))
    const guard = startGuard()
    guard.markStable()
    expect(readState()).to.deep.equal({ consecutiveCrashes: 0, running: false })
  })

  it('treats a malformed state file as a first start', () => {
    writeState({ consecutiveCrashes: 2, running: 'true' })
    const guard = startGuard()
    expect(guard.consecutiveCrashes).to.equal(0)
  })

  it('treats an unreadable state file as a first start', () => {
    fs.writeFileSync(stateFile, 'not json')
    const guard = startGuard()
    expect(guard.consecutiveCrashes).to.equal(0)
    expect(readState().running).to.equal(true)
  })
})

describe('StartupGuard signal handling', () => {
  it('terminates on SIGTERM even when another listener swallows it', function () {
    this.timeout(SIGNAL_GRACE_MS + 10_000)
    const configPath = fs.mkdtempSync(path.join(os.tmpdir(), 'startupguard-'))
    const script = `
      const { StartupGuard } = require(${JSON.stringify(path.join(__dirname, '..', 'dist', 'startupguard'))})
      new StartupGuard(process.argv[1]).begin()
      process.on('SIGTERM', () => {})
      setInterval(() => {}, 1000)
      console.log('ready')
    `
    return new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, ['-e', script, configPath])
      child.stdout.on('data', () => child.kill('SIGTERM'))
      child.on('exit', (code, signal) => {
        fs.rmSync(configPath, { recursive: true, force: true })
        try {
          expect(signal).to.equal('SIGTERM')
          expect(code).to.equal(null)
          resolve()
        } catch (err) {
          reject(err)
        }
      })
    })
  })
})
