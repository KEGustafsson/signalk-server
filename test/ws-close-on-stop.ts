import assert from 'assert'
import WebSocket from 'ws'
import { freeport } from './ts-servertestutilities'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { startServerP } = require('./servertestutilities')

const ABNORMAL_CLOSURE = 1006
const PRIMUS_SERVER_CLOSE = '"primus::server::close"'

interface CloseObservation {
  code: number
  messages: string[]
}

async function observeCloseOnStop(): Promise<CloseObservation> {
  const port = await freeport()
  const server = await startServerP(port, false)
  const ws = new WebSocket(
    `ws://localhost:${port}/signalk/v1/stream?subscribe=none`
  )
  const messages: string[] = []
  ws.on('message', (data) => messages.push(data.toString()))
  await new Promise((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
  })
  const closed = new Promise<number>((resolve) => ws.once('close', resolve))
  await server.stop()
  return { code: await closed, messages }
}

describe('WebSocket clients when the server stops', () => {
  const original = process.env.SIGNALK_WS_GRACEFUL_CLOSE

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SIGNALK_WS_GRACEFUL_CLOSE
    } else {
      process.env.SIGNALK_WS_GRACEFUL_CLOSE = original
    }
  })

  it('drops the connection without a close frame by default', async () => {
    delete process.env.SIGNALK_WS_GRACEFUL_CLOSE
    const { code, messages } = await observeCloseOnStop()
    assert.strictEqual(code, ABNORMAL_CLOSURE)
    assert(!messages.includes(PRIMUS_SERVER_CLOSE))
  })

  it('sends a close frame when SIGNALK_WS_GRACEFUL_CLOSE is true', async () => {
    process.env.SIGNALK_WS_GRACEFUL_CLOSE = 'true'
    const { code, messages } = await observeCloseOnStop()
    assert.notStrictEqual(code, ABNORMAL_CLOSURE)
    assert(messages.includes(PRIMUS_SERVER_CLOSE))
  })
})
