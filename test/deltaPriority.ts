import { SourceRef } from '@signalk/server-api'
import assert from 'assert'
import { getToPreferredDelta, SourcePrioritiesData } from '../src/deltaPriority'
import chai from 'chai'
chai.should()

describe('toPreferredDelta logic', () => {
  it('handles undefined values', () => {
    const sourcePreferences: SourcePrioritiesData = {}
    const toPreferredDelta = getToPreferredDelta(sourcePreferences, 200)

    const delta = toPreferredDelta(
      {
        context: 'self',
        updates: [
          {
            meta: [
              {
                path: 'environment.wind.speedApparent',
                value: { units: 'A' }
              }
            ]
          }
        ]
      },
      new Date(),
      'self'
    )
    assert(delta.updates[0].values === undefined)
  })

  it('respects timeouts at boot time', () => {
    const sourcePreferences: SourcePrioritiesData = {
      'navigation.position': [
        {
          sourceRef: 'gps.main' as SourceRef,
          timeout: 100 // Wait 100ms before falling back
        },
        {
          sourceRef: 'gps.backup' as SourceRef,
          timeout: 100 // Wait another 100ms before falling back
        },
        {
          sourceRef: 'gps.tertiary' as SourceRef,
          timeout: 100
        }
      ]
    }
    const toPreferredDelta = getToPreferredDelta(sourcePreferences, 400)

    // Test 1: Highest priority source should be accepted immediately
    const mainSourceDelta = toPreferredDelta(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.main' as SourceRef,
            values: [
              {
                path: 'navigation.position',
                value: { latitude: 60.1, longitude: 24.9 }
              }
            ]
          }
        ]
      },
      new Date(),
      'self'
    )
    // Highest priority should be accepted immediately
    assert.strictEqual(mainSourceDelta.updates[0].values.length, 1)

    // Test 2: Create new filter to test timeout behavior from boot
    const toPreferredDelta2 = getToPreferredDelta(sourcePreferences, 400)

    // Backup source should be rejected initially (before gps.main timeout expires)
    const backupSourceDeltaEarly = toPreferredDelta2(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.backup' as SourceRef,
            values: [
              {
                path: 'navigation.position',
                value: { latitude: 60.2, longitude: 24.8 }
              }
            ]
          }
        ]
      },
      new Date(Date.now() + 50), // 50ms after boot
      'self'
    )
    // Should be rejected (cumulative timeout for backup = 100ms, but only 50ms elapsed)
    assert.strictEqual(backupSourceDeltaEarly.updates[0].values.length, 0)

    // After timeout expires, backup source should be accepted
    const backupSourceDeltaLate = toPreferredDelta2(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.backup' as SourceRef,
            values: [
              {
                path: 'navigation.position',
                value: { latitude: 60.3, longitude: 24.7 }
              }
            ]
          }
        ]
      },
      new Date(Date.now() + 150), // 150ms after boot
      'self'
    )
    // Should be accepted (cumulative timeout for backup = 100ms, 150ms elapsed)
    assert.strictEqual(backupSourceDeltaLate.updates[0].values.length, 1)

    // Test 3: Tertiary source needs cumulative timeout of main + backup
    const toPreferredDelta3 = getToPreferredDelta(sourcePreferences, 400)

    const tertiarySourceEarly = toPreferredDelta3(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.tertiary' as SourceRef,
            values: [
              {
                path: 'navigation.position',
                value: { latitude: 60.4, longitude: 24.6 }
              }
            ]
          }
        ]
      },
      new Date(Date.now() + 150), // 150ms after boot
      'self'
    )
    // Should be rejected (cumulative timeout = 100 + 100 = 200ms, but only 150ms elapsed)
    assert.strictEqual(tertiarySourceEarly.updates[0].values.length, 0)

    const tertiarySourceLate = toPreferredDelta3(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.tertiary' as SourceRef,
            values: [
              {
                path: 'navigation.position',
                value: { latitude: 60.5, longitude: 24.5 }
              }
            ]
          }
        ]
      },
      new Date(Date.now() + 250), // 250ms after boot
      'self'
    )
    // Should be accepted (cumulative timeout = 200ms, 250ms elapsed)
    assert.strictEqual(tertiarySourceLate.updates[0].values.length, 1)

    // Test 4: Unknown source should respect unknownSourceTimeout
    const toPreferredDelta4 = getToPreferredDelta(sourcePreferences, 400)

    const unknownSourceEarly = toPreferredDelta4(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.unknown' as SourceRef,
            values: [
              {
                path: 'navigation.position',
                value: { latitude: 60.6, longitude: 24.4 }
              }
            ]
          }
        ]
      },
      new Date(Date.now() + 300), // 300ms after boot
      'self'
    )
    // Should be rejected (unknownSourceTimeout = 400ms, but only 300ms elapsed)
    assert.strictEqual(unknownSourceEarly.updates[0].values.length, 0)

    const unknownSourceLate = toPreferredDelta4(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.unknown' as SourceRef,
            values: [
              {
                path: 'navigation.position',
                value: { latitude: 60.7, longitude: 24.3 }
              }
            ]
          }
        ]
      },
      new Date(Date.now() + 450), // 450ms after boot
      'self'
    )
    // Should be accepted (unknownSourceTimeout = 400ms, 450ms elapsed)
    assert.strictEqual(unknownSourceLate.updates[0].values.length, 1)
  })

  it('filters 2nd priority source at boot, accepts after timeout', () => {
    const sourcePreferences: SourcePrioritiesData = {
      'navigation.speedOverGround': [
        {
          sourceRef: 'gps.primary' as SourceRef,
          timeout: 200 // Wait 200ms before accepting backup
        },
        {
          sourceRef: 'gps.secondary' as SourceRef,
          timeout: 200
        }
      ]
    }
    const toPreferredDelta = getToPreferredDelta(sourcePreferences, 500)

    // Feed 2nd priority source first at boot - should be rejected
    const secondaryEarly = toPreferredDelta(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.secondary' as SourceRef,
            values: [
              {
                path: 'navigation.speedOverGround',
                value: 5.2
              }
            ]
          }
        ]
      },
      new Date(Date.now() + 50), // 50ms after boot
      'self'
    )
    // Should be rejected (cumulative timeout = 200ms, only 50ms elapsed)
    assert.strictEqual(secondaryEarly.updates[0].values.length, 0)

    // Wait for timeout to expire, feed 2nd source again - should be accepted
    const secondaryLate = toPreferredDelta(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.secondary' as SourceRef,
            values: [
              {
                path: 'navigation.speedOverGround',
                value: 5.3
              }
            ]
          }
        ]
      },
      new Date(Date.now() + 250), // 250ms after boot (past 200ms timeout)
      'self'
    )
    // Should be accepted now (timeout expired, primary never showed up)
    assert.strictEqual(secondaryLate.updates[0].values.length, 1)
  })

  it('accepts 1st priority source when both send within timeout', () => {
    const sourcePreferences: SourcePrioritiesData = {
      'navigation.courseOverGroundTrue': [
        {
          sourceRef: 'gps.main' as SourceRef,
          timeout: 300
        },
        {
          sourceRef: 'gps.backup' as SourceRef,
          timeout: 300
        }
      ]
    }
    const toPreferredDelta = getToPreferredDelta(sourcePreferences, 500)

    // Feed 2nd priority source first
    const backupFirst = toPreferredDelta(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.backup' as SourceRef,
            values: [
              {
                path: 'navigation.courseOverGroundTrue',
                value: 180.5
              }
            ]
          }
        ]
      },
      new Date(Date.now() + 50), // 50ms after boot
      'self'
    )
    // Should be rejected (within timeout window, waiting for primary)
    assert.strictEqual(backupFirst.updates[0].values.length, 0)

    // Feed 1st priority source shortly after (still within timeout)
    const mainSource = toPreferredDelta(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.main' as SourceRef,
            values: [
              {
                path: 'navigation.courseOverGroundTrue',
                value: 181.2
              }
            ]
          }
        ]
      },
      new Date(Date.now() + 100), // 100ms after boot
      'self'
    )
    // Should be accepted (highest priority, no timeout needed)
    assert.strictEqual(mainSource.updates[0].values.length, 1)

    // Now feed backup again - should be rejected because primary is active
    const backupAfterMain = toPreferredDelta(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.backup' as SourceRef,
            values: [
              {
                path: 'navigation.courseOverGroundTrue',
                value: 180.8
              }
            ]
          }
        ]
      },
      new Date(Date.now() + 150), // 150ms after boot
      'self'
    )
    // Should be rejected (primary source is active and hasn't timed out)
    assert.strictEqual(backupAfterMain.updates[0].values.length, 0)
  })

  it('works', () => {
    const sourcePreferences: SourcePrioritiesData = {
      'environment.wind.speedApparent': [
        {
          sourceRef: 'a' as SourceRef,
          timeout: 0
        },
        {
          sourceRef: 'b' as SourceRef,
          timeout: 150
        },
        {
          sourceRef: 'c' as SourceRef,
          timeout: 150
        }
      ]
    }
    const toPreferredDelta = getToPreferredDelta(sourcePreferences, 200)

    let totalDelay = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = []
    const expectedResult: string[] = []
    let n = 0
    function push(sourceRef: string, delay: number, shouldBeEmitted: boolean) {
      totalDelay += delay
      if (shouldBeEmitted) {
        expectedResult.push(sourceRef)
      }
      setTimeout(() => {
        result.push(
          toPreferredDelta(
            {
              context: 'self',
              updates: [
                {
                  $source: sourceRef,
                  values: [
                    {
                      path: 'environment.wind.speedApparent',
                      value: n++
                    }
                  ]
                }
              ]
            },
            new Date(),
            'self'
          )
        )
      }, totalDelay)
    }

    push('a', 0, true)
    push('b', 50, false)
    push('c', 50, false)
    push('b', 100, true)
    push('a', 0, true)
    push('b', 10, false)
    push('c', 10, false)
    push('c', 150, true)
    push('b', 10, true)
    push('c', 10, false)
    push('c', 150, true)
    push('a', 10, true)
    push('b', 10, false)
    push('d', 0, false)
    push('c', 10, false)
    push('c', 150, true)
    push('d', 205, true)

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          result
            .filter((r) => r.updates[0].values.length > 0)
            .map((r) => r.updates[0].$source)
            .should.eql(expectedResult)
          resolve(undefined)
        } catch (err) {
          reject(err)
        }
      }, totalDelay + 10)
    })
  })
})
