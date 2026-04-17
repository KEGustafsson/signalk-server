import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Alert from 'react-bootstrap/Alert'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Card from 'react-bootstrap/Card'
import Form from 'react-bootstrap/Form'
import Table from 'react-bootstrap/Table'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp } from '@fortawesome/free-solid-svg-icons/faArrowUp'
import { faArrowDown } from '@fortawesome/free-solid-svg-icons/faArrowDown'
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons/faFloppyDisk'
import Creatable from 'react-select/creatable'
import { useSearchParams } from 'react-router-dom'
import { useStore, useSourcePriorities, useMultiSourcePaths } from '../../store'
import { type SourcesData } from '../../utils/sourceLabels'
import { useSourceAliases } from '../../hooks/useSourceAliases'

// Types
interface Priority {
  sourceRef: string
  timeout: string | number
}

interface PathPriority {
  path: string
  priorities: Priority[]
}

interface SelectOption {
  label: string
  value: string
}

interface PrefsEditorProps {
  path: string
  priorities: Priority[]
  pathIndex: number
  isSaving: boolean
  sourcesData: SourcesData | null
  multiSourcePaths: Record<string, string[]>
}

const PrefsEditor: React.FC<PrefsEditorProps> = ({
  path,
  priorities,
  pathIndex,
  isSaving,
  sourcesData,
  multiSourcePaths
}) => {
  const changePriority = useStore((s) => s.changePriority)
  const deletePriority = useStore((s) => s.deletePriority)
  const movePriority = useStore((s) => s.movePriority)
  const { getDisplayName } = useSourceAliases()

  const sourceRefs = useMemo(
    () => (path && multiSourcePaths[path]) || [],
    [path, multiSourcePaths]
  )

  const allOptions: SelectOption[] = sourceRefs.map((ref) => ({
    label: getDisplayName(ref, sourcesData),
    value: ref
  }))

  // Build rows: append an empty placeholder row if unassigned sources remain
  const rows = useMemo(() => {
    const assigned = new Set(priorities.map((p) => p.sourceRef).filter(Boolean))
    if (priorities.length >= sourceRefs.length) {
      return priorities
    }
    const hasUnassigned = sourceRefs.some((ref) => !assigned.has(ref))
    if (hasUnassigned) {
      return [...priorities, { sourceRef: '', timeout: 5000 }]
    }
    return priorities
  }, [priorities, sourceRefs])

  // Set of all sourceRefs currently shown in rows (for dropdown filtering)
  const selectedRefs = useMemo(
    () => new Set(rows.map((r) => r.sourceRef).filter(Boolean)),
    [rows]
  )

  return (
    <Table size="sm">
      <thead>
        <tr>
          <td style={{ width: '30px' }}>#</td>
          <td>Source Reference (see DataBrowser for details)</td>
          <td style={{ width: '140px' }}>Fallback after (ms)</td>
          <td style={{ width: '70px' }}>Enabled</td>
          <td style={{ width: '80px' }}>Order</td>
          <td></td>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ sourceRef, timeout }, index) => {
          // Filter dropdown to sources not already assigned to other rows
          const availableOptions = allOptions.filter(
            (o) => o.value === sourceRef || !selectedRefs.has(o.value)
          )
          const priorityKey = `${index}-${sourceRef || 'new'}`
          const isDisabled = Number(timeout) === -1
          return (
            <tr key={priorityKey}>
              <td>{index + 1}.</td>
              <td>
                <Creatable
                  menuPortalTarget={document.body}
                  options={availableOptions}
                  value={{
                    value: sourceRef,
                    label: getDisplayName(sourceRef, sourcesData)
                  }}
                  onChange={(e) => {
                    changePriority(pathIndex, index, e?.value || '', timeout)
                  }}
                />
              </td>
              <td>
                {index === 0 && !isDisabled ? (
                  <span className="text-muted small">preferred</span>
                ) : (
                  <Form.Control
                    type="number"
                    name="timeout"
                    disabled={isDisabled}
                    onChange={(e) =>
                      changePriority(
                        pathIndex,
                        index,
                        sourceRef,
                        e.target.value
                      )
                    }
                    value={isDisabled ? '' : timeout}
                  />
                )}
              </td>
              <td className="text-center">
                <Form.Check
                  type="checkbox"
                  checked={!isDisabled}
                  aria-label={`Enable source ${sourceRef || 'row ' + (index + 1)}`}
                  onChange={(e) =>
                    changePriority(
                      pathIndex,
                      index,
                      sourceRef,
                      e.target.checked ? (index === 0 ? 0 : 5000) : -1
                    )
                  }
                />
              </td>
              <td>
                {index > 0 && index < priorities.length && (
                  <button
                    type="button"
                    aria-label={`Move row ${index + 1} up`}
                    onClick={() =>
                      !isSaving && movePriority(pathIndex, index, -1)
                    }
                  >
                    <FontAwesomeIcon icon={faArrowUp} />
                  </button>
                )}
                {index < priorities.length - 1 && (
                  <button
                    type="button"
                    aria-label={`Move row ${index + 1} down`}
                    onClick={() =>
                      !isSaving && movePriority(pathIndex, index, 1)
                    }
                  >
                    <FontAwesomeIcon icon={faArrowDown} />
                  </button>
                )}
              </td>
              <td>
                {index < priorities.length && (
                  <button
                    type="button"
                    aria-label={`Delete row ${index + 1}`}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'inherit'
                    }}
                    onClick={() =>
                      !isSaving && deletePriority(pathIndex, index)
                    }
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}

function fetchAvailablePaths(cb: (paths: string[]) => void) {
  fetch(`${window.serverRoutesPrefix}/availablePaths`, {
    credentials: 'include'
  })
    .then((response) => response.json())
    .then(cb)
}

// ─── Fallback Timeline Diagram ──────────────────────────────────────────────
//
// Two sources over time. The Preferred source is sending then goes silent;
// the Backup source waits for "Fallback after" milliseconds of silence
// before it's allowed to take over.

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

    {/* Legend */}
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

    {/* Track labels */}
    <text x="0" y="56" fontSize="12" fill="#333" fontWeight="600">
      Preferred
    </text>
    <text x="0" y="106" fontSize="12" fill="#333" fontWeight="600">
      Backup 1
    </text>
    <text x="0" y="156" fontSize="12" fill="#333" fontWeight="600">
      Backup 2
    </text>

    {/* Preferred track */}
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

    {/* Backup 1 track */}
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

    {/* Backup 2 track */}
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

    {/* First threshold: Preferred → Backup 1 */}
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

    {/* Second threshold: Backup 1 → Backup 2 */}
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

    {/* Time axis */}
    <line x1="80" y1="200" x2="810" y2="200" stroke="#ccc" strokeWidth="1" />
    <text x="810" y="200" fontSize="10" fill="#999" textAnchor="end" dy="12">
      time →
    </text>

    {/* Caption */}
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

// ─── Main Page ──────────────────────────────────────────────────────────────

const SourcePriorities: React.FC = () => {
  const sourcePrioritiesData = useSourcePriorities()
  const changePath = useStore((s) => s.changePath)
  const deletePath = useStore((s) => s.deletePath)
  const setSaving = useStore((s) => s.setSaving)
  const setSaved = useStore((s) => s.setSaved)
  const setSaveFailed = useStore((s) => s.setSaveFailed)
  const clearSaveFailed = useStore((s) => s.clearSaveFailed)

  const { sourcePriorities, saveState } = sourcePrioritiesData

  const [availablePaths, setAvailablePaths] = useState<SelectOption[]>([])
  const [sourcesData, setSourcesData] = useState<SourcesData | null>(null)
  const multiSourcePaths = useMultiSourcePaths()

  const [searchParams, setSearchParams] = useSearchParams()

  // Compute unconfigured multi-source paths for warning banner
  const unconfiguredPaths = useMemo(() => {
    const configuredPaths = new Set<string>()
    for (const pp of sourcePriorities) {
      if (pp.path) configuredPaths.add(pp.path)
    }

    const result: string[] = []
    for (const path of Object.keys(multiSourcePaths)) {
      // Notifications bypass source priority server-side, so configuring
      // them here would be a no-op. Hide them from the warning banner.
      if (path === 'notifications' || path.startsWith('notifications.')) {
        continue
      }
      if (!configuredPaths.has(path)) result.push(path)
    }
    return result.sort()
  }, [multiSourcePaths, sourcePriorities])

  const pathParam = searchParams.get('path')
  useEffect(() => {
    if (!pathParam) return
    const alreadyExists = sourcePriorities.some((pp) => pp.path === pathParam)
    if (!alreadyExists) {
      changePath(sourcePriorities.length, pathParam)
    }
    setSearchParams({}, { replace: true })
  }, [pathParam, sourcePriorities, changePath, setSearchParams])

  const handleAddPath = useCallback(
    (path: string) => {
      const alreadyExists = sourcePriorities.some((pp) => pp.path === path)
      if (!alreadyExists) {
        changePath(sourcePriorities.length, path)
      }
    },
    [sourcePriorities, changePath]
  )

  useEffect(() => {
    fetchAvailablePaths((pathsArray) => {
      setAvailablePaths(
        pathsArray
          .filter(
            (path) =>
              path !== 'notifications' && !path.startsWith('notifications.')
          )
          .map((path) => ({
            value: path,
            label: path
          }))
      )
    })
    fetch('/signalk/v1/api/sources', { credentials: 'include' })
      .then((r) => r.json())
      .then(setSourcesData)
      .catch((err) => console.warn('Failed to load sources data:', err))
  }, [])

  // Check for incomplete entries (paths with empty sourceRef in priorities)
  const hasIncompleteEntries = useMemo(
    () =>
      sourcePriorities.some(
        (pp) => !pp.path || pp.priorities.some((prio) => !prio.sourceRef)
      ),
    [sourcePriorities]
  )

  const handleSave = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setSaving()
      // Filter out entries with empty path or priorities with empty sourceRef
      const cleanData = sourcePriorities.reduce<Record<string, Priority[]>>(
        (acc, pathPriority) => {
          if (!pathPriority.path) return acc
          const validPriorities = pathPriority.priorities.filter(
            (p) => p.sourceRef
          )
          if (validPriorities.length > 0) {
            acc[pathPriority.path] = validPriorities
          }
          return acc
        },
        {}
      )
      fetch(`${window.serverRoutesPrefix}/sourcePriorities`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanData)
      })
        .then((response) => {
          if (response.status === 200) {
            setSaved()
          } else {
            throw new Error()
          }
        })
        .catch(() => {
          setSaveFailed()
          setTimeout(() => clearSaveFailed(), 5000)
        })
    },
    [sourcePriorities, setSaving, setSaved, setSaveFailed, clearSaveFailed]
  )

  const priosWithEmpty: PathPriority[] = [
    ...sourcePriorities,
    { path: '', priorities: [] }
  ]

  return (
    <>
      <Card>
        <Card.Header>Source Priorities</Card.Header>
        <Card.Body>
          <Alert>
            <p>
              For each path, list the sources that may provide it in order of
              preference. The top source wins while it is sending. Each other
              row has a <b>Fallback after</b> value — how many milliseconds the
              higher-priority source must be silent before this row is allowed
              to take over.
            </p>
            <div style={{ margin: '12px 0' }}>
              <TimelineDiagram />
            </div>
            <p>
              <b>Example:</b> two GPS receivers, both publishing{' '}
              <code>navigation.position</code>. Preferred = Furuno, Backup =
              Garmin with <b>Fallback after 5000</b> (5s). Garmin data is
              dropped while Furuno is sending, and only starts passing through
              once Furuno has been silent for 5s. When Furuno returns, it
              immediately takes over again.
            </p>
            <p>
              The top row is always &quot;preferred&quot; — it has no Fallback
              value because nothing ranks higher. Uncheck <b>Enabled</b> to
              block a source on this path entirely. Data from unlisted sources
              can only take over after a default of 10 seconds of silence from
              every listed source.
            </p>
            <p>
              You can debug the settings by saving them and activating debug key{' '}
              <b>signalk-server:sourcepriorities</b> in{' '}
              <a
                href="./#/serverConfiguration/log"
                className="text-decoration-none"
              >
                Server Log
              </a>
            </p>
          </Alert>
          {unconfiguredPaths.length > 0 && (
            <Alert variant="warning">
              <strong>
                {unconfiguredPaths.length} path(s) have multiple sources without
                priority configuration:
              </strong>
              <div style={{ marginTop: '8px' }}>
                {unconfiguredPaths.map((p) => (
                  <Badge
                    key={p}
                    bg="warning"
                    text="dark"
                    style={{ margin: '2px', cursor: 'pointer' }}
                    onClick={() => handleAddPath(p)}
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            </Alert>
          )}
          <Table responsive bordered striped size="sm">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Path</th>
                <th>Priorities</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {priosWithEmpty.map(({ path, priorities }, index) => {
                // Path items may be empty for new entries
                const pathKey = `${index}-${path || 'new'}`
                return (
                  <tr key={pathKey}>
                    <td>
                      <Creatable
                        menuPortalTarget={document.body}
                        options={availablePaths}
                        value={{ value: path, label: path }}
                        onChange={(e) => {
                          changePath(index, e?.value || '')
                        }}
                      />
                    </td>
                    <td>
                      <PrefsEditor
                        key={path}
                        path={path}
                        priorities={priorities}
                        pathIndex={index}
                        isSaving={saveState.isSaving || false}
                        sourcesData={sourcesData}
                        multiSourcePaths={multiSourcePaths}
                      />
                    </td>
                    <td style={{ border: 'none' }}>
                      {index < sourcePriorities.length && (
                        <button
                          type="button"
                          aria-label={`Delete path ${path || index + 1}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: 'inherit'
                          }}
                          onClick={() => deletePath(index)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </Card.Body>
        <Card.Footer>
          <Button
            size="sm"
            variant="primary"
            disabled={
              !saveState.dirty ||
              saveState.isSaving ||
              !saveState.timeoutsOk ||
              hasIncompleteEntries
            }
            onClick={handleSave}
          >
            <FontAwesomeIcon icon={faFloppyDisk} /> Save
          </Button>
          {saveState.saveFailed && 'Saving priorities settings failed!'}
          {!saveState.timeoutsOk && (
            <span style={{ paddingLeft: '10px' }}>
              <Badge bg="danger">Error</Badge>
              {'Timeout values must be positive numbers (milliseconds).'}
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

export default SourcePriorities
