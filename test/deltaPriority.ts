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

  it('filters non-priority sources at boot time', () => {
    const sourcePreferences: SourcePrioritiesData = {
      'navigation.position': [
        {
          sourceRef: 'gps.main' as SourceRef,
          timeout: 5000
        },
        {
          sourceRef: 'gps.backup' as SourceRef,
          timeout: 5000
        }
      ]
    }
    const toPreferredDelta = getToPreferredDelta(sourcePreferences, 10000)

    // At boot time, non-priority source 'gps.unknown' should be rejected immediately
    const unknownSourceDelta = toPreferredDelta(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.unknown' as SourceRef,
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
    // Should filter out the value from unknown source at boot
    assert.strictEqual(unknownSourceDelta.updates[0].values.length, 0)

    // Priority source 'gps.backup' should be accepted at boot (even though it's not first priority)
    const backupSourceDelta = toPreferredDelta(
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
      new Date(),
      'self'
    )
    // Should accept the value from priority source
    assert.strictEqual(backupSourceDelta.updates[0].values.length, 1)

    // Higher priority source 'gps.main' should replace backup
    const mainSourceDelta = toPreferredDelta(
      {
        context: 'self',
        updates: [
          {
            $source: 'gps.main' as SourceRef,
            values: [
              {
                path: 'navigation.position',
                value: { latitude: 60.3, longitude: 24.7 }
              }
            ]
          }
        ]
      },
      new Date(),
      'self'
    )
    // Should accept the value from higher priority source
    assert.strictEqual(mainSourceDelta.updates[0].values.length, 1)
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
