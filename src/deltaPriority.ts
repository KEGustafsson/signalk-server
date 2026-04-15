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

export interface SourceRankingEntry {
  sourceRef: SourceRef
  timeout: number
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

const toRankingPrecedences = (
  ranking: SourceRankingEntry[]
): Map<SourceRef, SourcePrecedenceData> =>
  ranking.reduce<Map<SourceRef, SourcePrecedenceData>>(
    (acc, { sourceRef, timeout }, i) => {
      acc.set(sourceRef, { precedence: i, timeout })
      return acc
    },
    new Map<SourceRef, SourcePrecedenceData>()
  )

export type ToPreferredDelta = (
  delta: any,
  now: Date,
  selfContext: string
) => any

export const getToPreferredDelta = (
  sourcePrioritiesData: SourcePrioritiesData,
  sourceRanking?: SourceRankingEntry[],
  unknownSourceTimeout = 10000
): ToPreferredDelta => {
  if (!sourcePrioritiesData && (!sourceRanking || sourceRanking.length === 0)) {
    debug('No priorities data and no source ranking')
    return (delta: any, _now: Date, _selfContext: string) => delta
  }
  const precedences = sourcePrioritiesData
    ? toPrecedences(sourcePrioritiesData)
    : new Map<Path, PathPrecedences>()
  const rankingPrecedences =
    sourceRanking && sourceRanking.length > 0
      ? toRankingPrecedences(sourceRanking)
      : null

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

  const getPrecedence = (
    path: Path,
    sourceRef: SourceRef,
    isLatest: boolean
  ): SourcePrecedenceData => {
    // Path-level config takes priority
    const pathPrecedences = precedences.get(path)
    if (pathPrecedences) {
      const p = pathPrecedences.get(sourceRef)
      if (p) return p
      // Source not in path config — check if globally disabled before
      // falling back to unknown-source handling
      if (rankingPrecedences) {
        const rp = rankingPrecedences.get(sourceRef)
        if (rp && rp.timeout < 0) return rp
      }
      return isLatest ? HIGHESTPRECEDENCE : LOWESTPRECEDENCE
    }
    // Fall back to source-level ranking
    if (rankingPrecedences) {
      const p = rankingPrecedences.get(sourceRef)
      if (p) return p
      return isLatest ? HIGHESTPRECEDENCE : LOWESTPRECEDENCE
    }
    // No config at all — accept everything
    return HIGHESTPRECEDENCE
  }

  const isKnownSource = (path: Path, sourceRef: SourceRef): boolean => {
    const pathPrecedences = precedences.get(path)
    if (pathPrecedences?.has(sourceRef)) return true
    if (rankingPrecedences?.has(sourceRef)) return true
    return false
  }

  const isPreferredValue = (
    path: Path,
    latest: TimestampedSource,
    sourceRef: SourceRef,
    millis: number
  ) => {
    const pathPrecedences = precedences.get(path)

    // No path-level config AND no source ranking → accept all
    if (!pathPrecedences && !rankingPrecedences) {
      return true
    }

    const latestPrecedence = getPrecedence(path, latest.sourceRef, true)
    const incomingPrecedence = getPrecedence(path, sourceRef, false)

    // Negative timeout means the source is disabled — always reject
    if (incomingPrecedence.timeout < 0) {
      return false
    }

    const latestKnown = isKnownSource(path, latest.sourceRef)
    const incomingKnown = isKnownSource(path, sourceRef)

    // A configured source must always outrank an unconfigured one:
    // if the user ranked source X for this path, X should displace
    // any unranked competitor that happens to be publishing the same
    // path — otherwise the unknown incumbent keeps its HIGHESTPRECEDENCE
    // and the ranked source (with precedence >= 0) can never take over.
    if (incomingKnown && !latestKnown) {
      return true
    }

    // A source updating its own value is always accepted — but only if
    // the currently-latest source is actually configured. Otherwise an
    // unknown source that briefly won (e.g. because the configured
    // source was momentarily silent) would self-renew forever and
    // permanently shadow the configured preference.
    if (latest.sourceRef === sourceRef && (latestKnown || !incomingKnown)) {
      return true
    }

    const latestIsFromHigherPrecedence =
      latestPrecedence.precedence < incomingPrecedence.precedence

    // Baseline: the incoming (lower-ranked) source's timeout governs —
    // that is how path-level priority lists express "b may take over
    // after 5s of a-silence".
    //
    // Additional constraint when a known source is winning and an
    // unknown source tries to take over: the unknown source must also
    // outwait the winner's own timeout. Otherwise a ranked source
    // configured with a long timeout (e.g. the user's 60s preference
    // for a plugin) can still be stolen after just unknownSourceTimeout
    // by any random source that happens to publish the same path.
    const holdTimeout =
      latestKnown && !incomingKnown
        ? Math.max(latestPrecedence.timeout, incomingPrecedence.timeout)
        : incomingPrecedence.timeout

    const isPreferred =
      !latestIsFromHigherPrecedence || millis - latest.timestamp > holdTimeout
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
                // Notifications are events, not measurements — never subject
                // to source priority. Every source's notifications are
                // delivered unchanged.
                const p = pathValue.path as string
                if (p === 'notifications' || p.startsWith('notifications.')) {
                  acc.push(pathValue)
                  return acc
                }
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
