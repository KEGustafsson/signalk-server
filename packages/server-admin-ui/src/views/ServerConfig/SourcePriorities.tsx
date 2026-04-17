import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Alert from 'react-bootstrap/Alert'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Card from 'react-bootstrap/Card'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons/faFloppyDisk'
import { useSearchParams } from 'react-router-dom'

import {
  useStore,
  useSourcePriorities,
  useMultiSourcePaths,
  usePriorityGroups
} from '../../store'
import type { SourcesData } from '../../utils/sourceLabels'
import {
  computeGroups,
  reconcileGroups,
  fanOutGroupRanking,
  isPathOverride
} from '../../utils/sourceGroups'
import type { SourcePriority } from '../../store/types'
import PrefsEditor from './PrefsEditor'
import PriorityGroupCard from './PriorityGroupCard'

function fetchAvailablePaths(cb: (paths: string[]) => void) {
  fetch(`${window.serverRoutesPrefix}/availablePaths`, {
    credentials: 'include'
  })
    .then((response) => response.json())
    .then(cb)
}

const TimelineDiagram: React.FC = () => (
  <svg
    viewBox="0 0 840 300"
    xmlns="http://www.w3.org/2000/svg"
    style={{ maxWidth: '840px', width: '100%', height: 'auto' }}
    role="img"
    aria-label="Fallback timeline with three sources: Backup 1 takes over after Preferred is silent for Fallback after, then Backup 2 takes over after Backup 1 is also silent for its Fallback after. Each wait is measured from whichever source was last winning."
  >
    <defs>
      <marker
        id="arrow"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#555" />
      </marker>
    </defs>
    <rect x="0" y="0" width="10" height="10" fill="#2e7d32" rx="2" />
    <text x="16" y="9" fontSize="10" fill="#555">
      accepted (winning)
    </text>
    <rect x="150" y="0" width="10" height="10" fill="#bdbdbd" rx="2" />
    <text x="166" y="9" fontSize="10" fill="#555">
      ignored (not winning)
    </text>
    <rect x="305" y="0" width="10" height="10" fill="#1565c0" rx="2" />
    <text x="321" y="9" fontSize="10" fill="#555">
      accepted (takeover)
    </text>
    <text x="0" y="56" fontSize="12" fill="#333" fontWeight="600">
      Preferred
    </text>
    <text x="0" y="106" fontSize="12" fill="#333" fontWeight="600">
      Backup 1
    </text>
    <text x="0" y="156" fontSize="12" fill="#333" fontWeight="600">
      Backup 2
    </text>
    <rect x="80" y="48" width="30" height="16" fill="#2e7d32" rx="2" />
    <rect x="118" y="48" width="30" height="16" fill="#2e7d32" rx="2" />
    <rect x="156" y="48" width="30" height="16" fill="#2e7d32" rx="2" />
    <rect x="194" y="48" width="30" height="16" fill="#2e7d32" rx="2" />
    <rect x="232" y="48" width="30" height="16" fill="#2e7d32" rx="2" />
    <line
      x1="262"
      y1="56"
      x2="800"
      y2="56"
      stroke="#b71c1c"
      strokeWidth="1.5"
      strokeDasharray="4 3"
    />
    <text x="531" y="45" fontSize="11" fill="#b71c1c" textAnchor="middle">
      (silent)
    </text>
    <rect x="80" y="98" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="118" y="98" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="156" y="98" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="194" y="98" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="232" y="98" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="270" y="98" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="308" y="98" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="346" y="98" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="384" y="98" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="442" y="98" width="30" height="16" fill="#1565c0" rx="2" />
    <rect x="480" y="98" width="30" height="16" fill="#1565c0" rx="2" />
    <rect x="518" y="98" width="30" height="16" fill="#1565c0" rx="2" />
    <line
      x1="548"
      y1="106"
      x2="800"
      y2="106"
      stroke="#b71c1c"
      strokeWidth="1.5"
      strokeDasharray="4 3"
    />
    <text x="674" y="95" fontSize="11" fill="#b71c1c" textAnchor="middle">
      (silent)
    </text>
    <rect x="80" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="118" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="156" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="194" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="232" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="270" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="308" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="346" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="384" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="442" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="480" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="518" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="560" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="598" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="636" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="674" y="148" width="30" height="16" fill="#bdbdbd" rx="2" />
    <rect x="728" y="148" width="30" height="16" fill="#1565c0" rx="2" />
    <rect x="766" y="148" width="30" height="16" fill="#1565c0" rx="2" />
    <line
      x1="262"
      y1="30"
      x2="262"
      y2="185"
      stroke="#999"
      strokeWidth="1"
      strokeDasharray="3 3"
    />
    <text x="262" y="24" fontSize="10" fill="#555" textAnchor="middle">
      Preferred silent
    </text>
    <line
      x1="442"
      y1="30"
      x2="442"
      y2="185"
      stroke="#1565c0"
      strokeWidth="1"
      strokeDasharray="3 3"
    />
    <text x="442" y="24" fontSize="10" fill="#1565c0" textAnchor="middle">
      Backup 1 wins
    </text>
    <line
      x1="262"
      y1="80"
      x2="442"
      y2="80"
      stroke="#555"
      strokeWidth="1"
      markerStart="url(#arrow)"
      markerEnd="url(#arrow)"
    />
    <text x="352" y="76" fontSize="10" fill="#333" textAnchor="middle">
      Fallback after (5s)
    </text>
    <line
      x1="548"
      y1="80"
      x2="548"
      y2="185"
      stroke="#999"
      strokeWidth="1"
      strokeDasharray="3 3"
    />
    <text x="548" y="74" fontSize="10" fill="#555" textAnchor="middle">
      Backup 1 silent
    </text>
    <line
      x1="728"
      y1="130"
      x2="728"
      y2="185"
      stroke="#1565c0"
      strokeWidth="1"
      strokeDasharray="3 3"
    />
    <text x="728" y="126" fontSize="10" fill="#1565c0" textAnchor="middle">
      Backup 2 wins
    </text>
    <line
      x1="548"
      y1="175"
      x2="728"
      y2="175"
      stroke="#555"
      strokeWidth="1"
      markerStart="url(#arrow)"
      markerEnd="url(#arrow)"
    />
    <text x="638" y="171" fontSize="10" fill="#333" textAnchor="middle">
      Fallback after (5s)
    </text>
    <line x1="80" y1="200" x2="810" y2="200" stroke="#ccc" strokeWidth="1" />
    <text x="810" y="200" fontSize="10" fill="#999" textAnchor="end" dy="12">
      time →
    </text>
    <text
      x="420"
      y="240"
      fontSize="11"
      fill="#333"
      textAnchor="middle"
      fontWeight="600"
    >
      Each row&apos;s Fallback timer starts from the last source that was
      winning — not from row 1.
    </text>
    <text x="420" y="256" fontSize="10" fill="#666" textAnchor="middle">
      Backup 2 waits for Backup 1 to go silent, then 5 s more. It does NOT kick
      in 5 s after Preferred.
    </text>
    <text x="420" y="272" fontSize="10" fill="#666" textAnchor="middle">
      If Backup 1 keeps sending, Backup 2 never wins — only the next row up in
      the chain matters.
    </text>
  </svg>
)

const SourcePriorities: React.FC = () => {
  const sourcePrioritiesData = useSourcePriorities()
  const priorityGroupsData = usePriorityGroups()
  const multiSourcePaths = useMultiSourcePaths()

  const setSaving = useStore((s) => s.setSaving)
  const setSaved = useStore((s) => s.setSaved)
  const setSaveFailed = useStore((s) => s.setSaveFailed)
  const clearSaveFailed = useStore((s) => s.clearSaveFailed)
  const setGroupsSaving = useStore((s) => s.setGroupsSaving)
  const setGroupsSaved = useStore((s) => s.setGroupsSaved)
  const setGroupsSaveFailed = useStore((s) => s.setGroupsSaveFailed)
  const setSourcePriorities = useStore((s) => s.setSourcePriorities)
  const changePath = useStore((s) => s.changePath)
  const deletePath = useStore((s) => s.deletePath)

  const { sourcePriorities, saveState } = sourcePrioritiesData
  const { groups: savedGroups, saveState: groupsSaveState } = priorityGroupsData

  const [sourcesData, setSourcesData] = useState<SourcesData | null>(null)
  const [availablePaths, setAvailablePaths] = useState<string[]>([])
  const [searchParams, setSearchParams] = useSearchParams()

  const derived = useMemo(
    () => computeGroups(multiSourcePaths),
    [multiSourcePaths]
  )
  const reconciled = useMemo(
    () => reconcileGroups(derived, savedGroups),
    [derived, savedGroups]
  )

  // Sync reconciled ordering back into the groups slice so DnD edits the right
  // source. We only hydrate when a saved group's order is stale vs. the derived
  // set; we never clobber dirty edits.
  useEffect(() => {
    if (groupsSaveState.dirty) return
    const next = reconciled.map((g) => ({ id: g.id, sources: g.sources }))
    const sameShape =
      next.length === savedGroups.length &&
      next.every((g, i) => {
        const s = savedGroups[i]
        return (
          s?.id === g.id &&
          s.sources.length === g.sources.length &&
          s.sources.every((src, j) => src === g.sources[j])
        )
      })
    if (!sameShape) {
      useStore.getState().setPriorityGroupsFromServer(next)
    }
  }, [reconciled, savedGroups, groupsSaveState.dirty])

  // Ungrouped overrides: paths in sourcePriorities whose path is not in any
  // derived group's path list. These include plugin-only paths or paths with
  // a single source (user may have pre-configured).
  const groupPathSet = useMemo(() => {
    const all = new Set<string>()
    for (const g of reconciled) for (const p of g.paths) all.add(p)
    return all
  }, [reconciled])

  const ungroupedOverrides = useMemo(
    () =>
      sourcePriorities
        .map((pp, index) => ({ pp, index }))
        .filter(({ pp }) => pp.path && !groupPathSet.has(pp.path))
        .sort((a, b) => a.pp.path.localeCompare(b.pp.path)),
    [sourcePriorities, groupPathSet]
  )

  // Count of groups that have no saved ranking yet (all new / never seen).
  const unrankedGroupCount = useMemo(
    () => reconciled.filter((g) => g.matchedSavedId === null).length,
    [reconciled]
  )

  const pathParam = searchParams.get('path')
  useEffect(() => {
    if (!pathParam) return
    const alreadyExists = sourcePriorities.some((pp) => pp.path === pathParam)
    if (!alreadyExists) {
      changePath(sourcePriorities.length, pathParam)
    }
    setSearchParams({}, { replace: true })
  }, [pathParam, sourcePriorities, changePath, setSearchParams])

  useEffect(() => {
    fetchAvailablePaths((pathsArray) => {
      setAvailablePaths(
        pathsArray.filter(
          (p) => p !== 'notifications' && !p.startsWith('notifications.')
        )
      )
    })
    fetch('/signalk/v1/api/sources', { credentials: 'include' })
      .then((r) => r.json())
      .then(setSourcesData)
      .catch((err) => console.warn('Failed to load sources data:', err))
  }, [])

  const hasIncompleteEntries = useMemo(
    () =>
      sourcePriorities.some(
        (pp) => !pp.path || pp.priorities.some((prio) => !prio.sourceRef)
      ),
    [sourcePriorities]
  )

  const isDirty = saveState.dirty || groupsSaveState.dirty
  const isSaving = !!(saveState.isSaving || groupsSaveState.isSaving)

  const handleSave = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()

      setGroupsSaving()
      setSaving()

      // Build the override set — per group, any path where current ordering
      // differs from group order.
      const nextPriorityMap: Record<string, SourcePriority[]> =
        sourcePriorities.reduce<Record<string, SourcePriority[]>>((acc, pp) => {
          if (!pp.path) return acc
          const valid = pp.priorities.filter((p) => p.sourceRef)
          if (valid.length > 0) acc[pp.path] = valid
          return acc
        }, {})

      // Build a lookup from groupId → saved sources BEFORE this save, so we
      // can distinguish "user edited the group ranking" from "user set a
      // path-level override". Override detection compares against the saved
      // (baseline) group order — never against the newly-edited order.
      const baselineSourcesById = new Map<string, string[]>()
      for (const g of savedGroups) baselineSourcesById.set(g.id, g.sources)

      let fannedOut = { ...nextPriorityMap }
      for (const group of reconciled) {
        const baseline =
          (group.matchedSavedId &&
            baselineSourcesById.get(group.matchedSavedId)) ||
          group.sources
        const overridePaths = new Set<string>()
        for (const path of group.paths) {
          const existing = nextPriorityMap[path]
          const publishers = new Set(multiSourcePaths[path] ?? [])
          const baselineOrder = baseline.filter((src) => publishers.has(src))
          if (existing && isPathOverride(existing, baselineOrder)) {
            overridePaths.add(path)
          }
        }
        fannedOut = fanOutGroupRanking(
          { sources: group.sources, paths: group.paths },
          multiSourcePaths,
          fannedOut,
          overridePaths
        )
      }

      try {
        const [groupsRes, prioritiesRes] = await Promise.all([
          fetch(`${window.serverRoutesPrefix}/priorityGroups`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              reconciled.map((g) => ({ id: g.id, sources: g.sources }))
            )
          }),
          fetch(`${window.serverRoutesPrefix}/sourcePriorities`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fannedOut)
          })
        ])

        if (groupsRes.status !== 200 || prioritiesRes.status !== 200) {
          throw new Error('save failed')
        }
        setGroupsSaved()
        setSaved()
        setSourcePriorities(fannedOut)
      } catch {
        setGroupsSaveFailed()
        setSaveFailed()
        setTimeout(() => clearSaveFailed(), 5000)
      }
    },
    [
      reconciled,
      sourcePriorities,
      multiSourcePaths,
      setGroupsSaving,
      setGroupsSaved,
      setGroupsSaveFailed,
      setSaving,
      setSaved,
      setSaveFailed,
      clearSaveFailed,
      setSourcePriorities
    ]
  )

  return (
    <>
      <Card>
        <Card.Header>Source Priorities</Card.Header>
        <Card.Body>
          <Alert>
            <p>
              Signal K groups sources that share paths. Inside each group, drag
              the sources into your preferred order — the top one wins every
              shared path while it is sending. Each row below the top waits{' '}
              <b>Fallback after</b> milliseconds of silence from the source
              currently winning before it may take over.
            </p>
            <div style={{ margin: '12px 0' }}>
              <TimelineDiagram />
            </div>
            <p>
              <b>Example:</b> two GPS receivers both publishing{' '}
              <code>navigation.position</code> and a few related paths land in
              one group. Drag Furuno above Garmin and every shared path prefers
              Furuno. Add a <b>path-level override</b> only when you want a
              specific path to deviate — e.g. use Garmin&apos;s magnetic
              variation if its WMM model is better.
            </p>
            <p>
              The top row is always &quot;preferred&quot; — it has no Fallback
              value because nothing ranks higher. Uncheck <b>Enabled</b> on an
              override row to block a source on that path entirely. Data from
              unlisted sources can only take over after a default of 10 seconds
              of silence from every listed source.
            </p>
            <p>
              You can debug the settings by activating debug key{' '}
              <b>signalk-server:sourcepriorities</b> in{' '}
              <a
                href="./#/serverConfiguration/log"
                className="text-decoration-none"
              >
                Server Log
              </a>
            </p>
          </Alert>

          {unrankedGroupCount > 0 && (
            <Alert variant="warning">
              <strong>
                {unrankedGroupCount} group
                {unrankedGroupCount === 1 ? '' : 's'} without a saved ranking:
              </strong>{' '}
              drag sources into your preferred order inside each card below to
              rank them.
            </Alert>
          )}

          {reconciled.length === 0 && (
            <Alert variant="info">
              No multi-source paths detected yet. When more than one source
              starts publishing the same path, a group card will appear here.
            </Alert>
          )}

          {reconciled.map((group) => (
            <PriorityGroupCard
              key={group.id}
              group={group}
              multiSourcePaths={multiSourcePaths}
              sourcePriorities={sourcePriorities}
              sourcesData={sourcesData}
              isSaving={isSaving}
            />
          ))}

          {ungroupedOverrides.length > 0 && (
            <Card className="pg-card pg-card-unranked mt-3">
              <Card.Header>
                <strong>Ungrouped path overrides</strong>
                <span className="text-muted small ms-2">
                  {ungroupedOverrides.length} path
                  {ungroupedOverrides.length === 1 ? '' : 's'}
                </span>
              </Card.Header>
              <Card.Body>
                {ungroupedOverrides.map(({ pp, index }) => (
                  <div key={pp.path} className="pg-override-row">
                    <div className="pg-override-path d-flex justify-content-between align-items-center">
                      <code>{pp.path}</code>
                      <Button
                        size="sm"
                        variant="link"
                        className="text-danger"
                        onClick={() => deletePath(index)}
                      >
                        Remove
                      </Button>
                    </div>
                    <PrefsEditor
                      path={pp.path}
                      priorities={pp.priorities}
                      pathIndex={index}
                      isSaving={isSaving}
                      sourcesData={sourcesData}
                      multiSourcePaths={multiSourcePaths}
                    />
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}

          <AddUngroupedOverride
            availablePaths={availablePaths}
            groupPathSet={groupPathSet}
            configuredPaths={new Set(sourcePriorities.map((p) => p.path))}
            onAdd={(path) => changePath(sourcePriorities.length, path)}
          />
        </Card.Body>
        <Card.Footer>
          <Button
            size="sm"
            variant="primary"
            disabled={
              !isDirty ||
              isSaving ||
              !saveState.timeoutsOk ||
              hasIncompleteEntries
            }
            onClick={handleSave}
          >
            <FontAwesomeIcon icon={faFloppyDisk} /> Save
          </Button>
          {(saveState.saveFailed || groupsSaveState.saveFailed) &&
            ' Saving priorities settings failed!'}
          {!saveState.timeoutsOk && (
            <span style={{ paddingLeft: '10px' }}>
              <Badge bg="danger">Error</Badge>
              {' Timeout values must be positive numbers (milliseconds).'}
            </span>
          )}
          {hasIncompleteEntries && (
            <span style={{ paddingLeft: '10px' }}>
              <Badge bg="warning" text="dark">
                Warning
              </Badge>
              {' All entries must have a path and source reference set.'}
            </span>
          )}
        </Card.Footer>
      </Card>
    </>
  )
}

interface AddUngroupedOverrideProps {
  availablePaths: string[]
  groupPathSet: Set<string>
  configuredPaths: Set<string>
  onAdd: (path: string) => void
}

const AddUngroupedOverride: React.FC<AddUngroupedOverrideProps> = ({
  availablePaths,
  groupPathSet,
  configuredPaths,
  onAdd
}) => {
  const [value, setValue] = useState('')
  const options = useMemo(
    () =>
      availablePaths.filter(
        (p) => !groupPathSet.has(p) && !configuredPaths.has(p)
      ),
    [availablePaths, groupPathSet, configuredPaths]
  )
  if (options.length === 0) return null
  return (
    <div className="mt-3">
      <label className="form-label small text-muted">
        Add an ungrouped path-level override
      </label>
      <select
        className="form-select form-select-sm pg-add-override-select"
        value={value}
        onChange={(e) => {
          const v = e.target.value
          if (!v) return
          onAdd(v)
          setValue('')
        }}
      >
        <option value="">Select a path…</option>
        {options.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  )
}

export default SourcePriorities
