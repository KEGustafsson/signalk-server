/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context, Path, SourceRef } from '@signalk/server-api'
import { createDebug } from './debug'
const debug = createDebug('signalk-server:sourcepriorities')

interface SourcePriority {
  sourceRef: SourceRef
  timeout: number
}

export interface SourcePrioritiesData {
  [path: string]: SourcePriority[]
}

interface PathValue {
  path: string
  value: any
}

interface TimestampedSource {
  timestamp: number
  sourceRef: SourceRef
}

interface SourcePrecedenceData {
  precedence: number
  timeout: number
}

type PathLatestTimestamps = Map<Path, TimestampedSource>

type PathPrecedences = Map<SourceRef, SourcePrecedenceData>
const toPrecedences = (sourcePrioritiesMap: {
  [path: string]: SourcePriority[]
}) =>
  Object.keys(sourcePrioritiesMap).reduce<Map<Path, PathPrecedences>>(
    (acc, path: string) => {
      const priorityIndices = sourcePrioritiesMap[path].reduce<PathPrecedences>(
        (acc2, { sourceRef, timeout }, i: number) => {
          acc2.set(sourceRef, {
            precedence: i,
            timeout
          })
          return acc2
        },
        new Map<SourceRef, SourcePrecedenceData>()
      )
      acc.set(path as Path, priorityIndices)
      return acc
    },
    new Map<Path, PathPrecedences>()
  )

export type ToPreferredDelta = (
  delta: any,
  now: Date,
  selfContext: string
) => any

export const getToPreferredDelta = (
  sourcePrioritiesData: SourcePrioritiesData,
  unknownSourceTimeout = 10000
): ToPreferredDelta => {
  if (!sourcePrioritiesData) {
    debug('No priorities data')
    return (delta: any, _now: Date, _selfContext: string) => delta
  }
  const precedences = toPrecedences(sourcePrioritiesData)

  const contextPathTimestamps = new Map<Context, PathLatestTimestamps>()

  const setLatest = (
    context: Context,
    path: Path,
    sourceRef: SourceRef,
    millis: number
  ) => {
    let pathLatestTimestamps = contextPathTimestamps.get(context)
    if (!pathLatestTimestamps) {
      pathLatestTimestamps = new Map<Path, TimestampedSource>()
      contextPathTimestamps.set(context, pathLatestTimestamps)
    }
    pathLatestTimestamps.set(path, { sourceRef, timestamp: millis })
  }

  const getLatest = (context: Context, path: Path): TimestampedSource => {
    const pathLatestTimestamps = contextPathTimestamps.get(context)
    if (!pathLatestTimestamps) {
      return {
        sourceRef: '' as SourceRef,
        timestamp: 0
      }
    }
    const latestTimestamp = pathLatestTimestamps.get(path)
    if (!latestTimestamp) {
      return {
        sourceRef: '' as SourceRef,
        timestamp: 0
      }
    }
    return latestTimestamp
  }

  const HIGHESTPRECEDENCE = {
    precedence: 0,
    timeout: 0
  }

  const LOWESTPRECEDENCE = {
    precedence: Number.POSITIVE_INFINITY,
    timeout: unknownSourceTimeout
  }

  const isPreferredValue = (
    path: Path,
    latest: TimestampedSource,
    sourceRef: SourceRef,
    millis: number
  ) => {
    const pathPrecedences: PathPrecedences | undefined = precedences.get(path)

    if (!pathPrecedences) {
      return true
    }

    // Special case: no value received yet for this path
    // Accept any source from the priority list immediately
    // Reject sources not in the priority list (they can only be used for failover)
    // This fixes boot-time filtering where all sources were incorrectly allowed through
    if (latest.sourceRef === '') {
      const incomingPrecedence = pathPrecedences.get(sourceRef)
      if (incomingPrecedence) {
        // Source is in priority list - accept it as the first value
        if (debug.enabled) {
          debug(`${path}:${sourceRef}:true:first-value`)
        }
        return true
      }
      // Source not in priority list - reject at boot (no source to fail over from)
      if (debug.enabled) {
        debug(`${path}:${sourceRef}:false:unknown-source-at-boot`)
      }
      return false
    }

    const latestPrecedence =
      pathPrecedences.get(latest.sourceRef) || HIGHESTPRECEDENCE
    const incomingPrecedence =
      pathPrecedences.get(sourceRef) || LOWESTPRECEDENCE

    const latestIsFromHigherPrecedence =
      latestPrecedence.precedence < incomingPrecedence.precedence

    const isPreferred =
      !latestIsFromHigherPrecedence ||
      millis - latest.timestamp > incomingPrecedence.timeout
    if (debug.enabled) {
      debug(`${path}:${sourceRef}:${isPreferred}:${millis - latest.timestamp}`)
    }
    return isPreferred
  }

  return (delta: any, now: Date, selfContext: string) => {
    if (delta.context === selfContext) {
      const millis = now.getTime()
      delta.updates &&
        delta.updates.forEach((update: any) => {
          if ('values' in update) {
            update.values = update.values.reduce(
              (acc: any, pathValue: PathValue) => {
                const latest = getLatest(
                  delta.context as Context,
                  pathValue.path as Path
                )
                const isPreferred = isPreferredValue(
                  pathValue.path as Path,
                  latest,
                  update.$source,
                  millis
                )
                if (isPreferred) {
                  setLatest(
                    delta.context as Context,
                    pathValue.path as Path,
                    update.$source as SourceRef,
                    millis
                  )
                  acc.push(pathValue)
                  return acc
                }
                return acc
              },
              []
            )
          }
        })
    }
    return delta
  }
}
