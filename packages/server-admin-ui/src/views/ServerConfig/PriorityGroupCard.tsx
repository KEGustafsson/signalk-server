import React, { useMemo, useState } from 'react'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Card from 'react-bootstrap/Card'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGripVertical } from '@fortawesome/free-solid-svg-icons/faGripVertical'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown'
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight'
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus'
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons/faCircleCheck'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { useStore } from '../../store'
import type { ReconciledGroup } from '../../utils/sourceGroups'
import { isPathOverride } from '../../utils/sourceGroups'
import type { SourcesData } from '../../utils/sourceLabels'
import { useSourceAliases } from '../../hooks/useSourceAliases'
import PrefsEditor from './PrefsEditor'
import type { PathPriority } from '../../store/types'

interface SortableSourceRowProps {
  sourceRef: string
  index: number
  label: string
  pathCount: number
  isPreferred: boolean
}

const SortableSourceRow: React.FC<SortableSourceRowProps> = ({
  sourceRef,
  index,
  label,
  pathCount,
  isPreferred
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: sourceRef })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? '0 6px 14px rgba(0,0,0,0.12)' : 'none',
    zIndex: isDragging ? 2 : undefined
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="pg-source-row"
      aria-roledescription="sortable"
      aria-label={`Source ${label}, rank ${index + 1}`}
    >
      <button
        type="button"
        className="pg-drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${label}`}
      >
        <FontAwesomeIcon icon={faGripVertical} />
      </button>
      <span className="pg-rank">{index + 1}.</span>
      <span className="pg-source-label">{label}</span>
      {isPreferred && (
        <Badge bg="success" className="pg-preferred-badge">
          <FontAwesomeIcon icon={faCircleCheck} /> preferred
        </Badge>
      )}
      <span className="pg-paths-count text-muted small">
        wins on {pathCount} path{pathCount === 1 ? '' : 's'}
      </span>
    </li>
  )
}

interface PriorityGroupCardProps {
  group: ReconciledGroup
  multiSourcePaths: Record<string, string[]>
  sourcePriorities: PathPriority[]
  sourcesData: SourcesData | null
  isSaving: boolean
}

const PriorityGroupCard: React.FC<PriorityGroupCardProps> = ({
  group,
  multiSourcePaths,
  sourcePriorities,
  sourcesData,
  isSaving
}) => {
  const reorderGroupSources = useStore((s) => s.reorderGroupSources)
  const changePath = useStore((s) => s.changePath)
  const { getDisplayName } = useSourceAliases()

  const [showOverrides, setShowOverrides] = useState(true)
  const [showPaths, setShowPaths] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // Paths in this group that publish >=2 of the group's sources.
  const groupPathSet = useMemo(() => new Set(group.paths), [group.paths])

  // For each path, count winners per source under the current ranking.
  const winnerCountBySource = useMemo(() => {
    const counts = new Map<string, number>()
    for (const source of group.sources) counts.set(source, 0)
    for (const path of group.paths) {
      const publishers = new Set(multiSourcePaths[path] ?? [])
      const winner = group.sources.find((src) => publishers.has(src))
      if (winner) counts.set(winner, (counts.get(winner) ?? 0) + 1)
    }
    return counts
  }, [group.paths, group.sources, multiSourcePaths])

  // Which paths in this group are overrides (differ from group ordering)?
  const overridePathsSet = useMemo(() => {
    const result = new Set<string>()
    for (const pp of sourcePriorities) {
      if (!groupPathSet.has(pp.path)) continue
      const publishers = new Set(multiSourcePaths[pp.path] ?? [])
      const expected = group.sources.filter((src) => publishers.has(src))
      if (isPathOverride(pp.priorities, expected)) {
        result.add(pp.path)
      }
    }
    return result
  }, [sourcePriorities, groupPathSet, multiSourcePaths, group.sources])

  const overrideRows = useMemo(
    () =>
      sourcePriorities
        .map((pp, index) => ({ pp, index }))
        .filter(({ pp }) => overridePathsSet.has(pp.path))
        .sort((a, b) => a.pp.path.localeCompare(b.pp.path)),
    [sourcePriorities, overridePathsSet]
  )

  const nonOverridePaths = useMemo(
    () => group.paths.filter((p) => !overridePathsSet.has(p)).sort(),
    [group.paths, overridePathsSet]
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = group.sources.indexOf(String(active.id))
    const to = group.sources.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    reorderGroupSources(group.id, from, to)
  }

  const rankedLabel =
    group.matchedSavedId !== null
      ? 'Ranked'
      : 'No ranking saved yet — drag to set order'

  return (
    <Card
      className={`pg-card ${group.matchedSavedId ? '' : 'pg-card-unranked'}`}
    >
      <Card.Header className="d-flex align-items-center justify-content-between">
        <div>
          <strong>
            {group.sources.length} sources · {group.paths.length} shared paths
          </strong>
          <span className="text-muted small ms-2">{rankedLabel}</span>
        </div>
        <Button
          size="sm"
          variant="link"
          className="pg-toggle-paths"
          onClick={() => setShowPaths((v) => !v)}
          aria-expanded={showPaths}
        >
          <FontAwesomeIcon icon={showPaths ? faChevronDown : faChevronRight} />{' '}
          Paths
        </Button>
      </Card.Header>
      {showPaths && (
        <Card.Body className="pg-paths-list">
          <div className="d-flex flex-wrap gap-1">
            {group.paths.map((p) => (
              <Badge
                key={p}
                bg={overridePathsSet.has(p) ? 'warning' : 'secondary'}
                text={overridePathsSet.has(p) ? 'dark' : undefined}
                className="pg-path-chip"
                title={
                  overridePathsSet.has(p)
                    ? 'Path has an explicit override'
                    : 'Path follows group ranking'
                }
              >
                {p}
              </Badge>
            ))}
          </div>
        </Card.Body>
      )}
      <Card.Body className="pg-ranking-body">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={group.sources}
            strategy={verticalListSortingStrategy}
          >
            <ul className="pg-source-list">
              {group.sources.map((src, i) => (
                <SortableSourceRow
                  key={src}
                  sourceRef={src}
                  index={i}
                  label={getDisplayName(src, sourcesData)}
                  pathCount={winnerCountBySource.get(src) ?? 0}
                  isPreferred={i === 0}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </Card.Body>
      <Card.Body className="pg-overrides-section">
        <div className="d-flex align-items-center justify-content-between">
          <Button
            size="sm"
            variant="link"
            onClick={() => setShowOverrides((v) => !v)}
            aria-expanded={showOverrides}
            className="pg-toggle-overrides"
          >
            <FontAwesomeIcon
              icon={showOverrides ? faChevronDown : faChevronRight}
            />{' '}
            Path-level overrides ({overrideRows.length})
          </Button>
          {nonOverridePaths.length > 0 && (
            <select
              className="form-select form-select-sm pg-add-override-select"
              value=""
              onChange={(e) => {
                const value = e.target.value
                if (!value) return
                // Adding a path to sourcePriorities creates a new row. The row
                // starts as the group's own ordering — which is not an override
                // yet. But the user's intent is to deviate, so we add it and
                // let them edit. To force "override" classification we pre-fill
                // with group order (matches) — that's fine; user will tweak
                // and it becomes an override on first change.
                changePath(sourcePriorities.length, value)
              }}
            >
              <option value="">+ Add override…</option>
              {nonOverridePaths.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
        </div>
        {showOverrides && overrideRows.length > 0 && (
          <div className="pg-overrides-list mt-2">
            {overrideRows.map(({ pp, index }) => (
              <div key={pp.path} className="pg-override-row">
                <div className="pg-override-path">
                  <FontAwesomeIcon icon={faPlus} className="me-1 text-muted" />
                  <code>{pp.path}</code>
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
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

export default PriorityGroupCard
