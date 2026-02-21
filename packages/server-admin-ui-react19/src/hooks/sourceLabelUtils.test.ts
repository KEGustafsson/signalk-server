import { describe, it, expect } from 'vitest'
import { getSourceDisplayLabel } from './sourceLabelUtils'

describe('sourceLabelUtils', () => {
  it('uses ws device top-level description for plain ws source refs', () => {
    const sources = {
      ws: {
        myDevice: {
          description: 'Cabin Tablet'
        }
      }
    }

    expect(getSourceDisplayLabel('ws.myDevice', sources)).toBe('Cabin Tablet')
  })

  it('uses ws device top-level description for nested ws source refs', () => {
    const sources = {
      ws: {
        myDevice: {
          description: 'Cabin Tablet',
          n2k: {
            description: 'Wrong place'
          }
        }
      }
    }

    expect(getSourceDisplayLabel('ws.myDevice.n2k.204', sources)).toBe(
      'Cabin Tablet'
    )
  })

  it('uses n2k description as fallback for nested ws source refs', () => {
    const sources = {
      ws: {
        myDevice: {
          n2k: {
            description: 'Legacy Device Name'
          }
        }
      }
    }

    expect(getSourceDisplayLabel('ws.myDevice.n2k.204', sources)).toBe(
      'Legacy Device Name'
    )
  })

  it('falls back to sourceRef when ws device description is missing', () => {
    const sources = {
      ws: {
        myDevice: {}
      }
    }

    expect(getSourceDisplayLabel('ws.myDevice.n2k.204', sources)).toBe(
      'ws.myDevice.n2k.204'
    )
  })

  it('falls back to sourceRef for non-ws source refs', () => {
    const sources = {
      nmea0183: {
        tcp: {
          description: 'NMEA tcp'
        }
      }
    }

    expect(getSourceDisplayLabel('nmea0183.tcp', sources)).toBe('nmea0183.tcp')
  })
})
