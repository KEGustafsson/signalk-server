import React, { useMemo } from 'react'
import Form from 'react-bootstrap/Form'
import Table from 'react-bootstrap/Table'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp } from '@fortawesome/free-solid-svg-icons/faArrowUp'
import { faArrowDown } from '@fortawesome/free-solid-svg-icons/faArrowDown'
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash'
import Creatable from 'react-select/creatable'
import { useStore } from '../../store'
import { type SourcesData } from '../../utils/sourceLabels'
import { useSourceAliases } from '../../hooks/useSourceAliases'

interface Priority {
  sourceRef: string
  timeout: string | number
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

export const PrefsEditor: React.FC<PrefsEditorProps> = ({
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

  const rows = useMemo(() => {
    const assigned = new Set(priorities.map((p) => p.sourceRef).filter(Boolean))
    if (priorities.length >= sourceRefs.length) return priorities
    const hasUnassigned = sourceRefs.some((ref) => !assigned.has(ref))
    if (hasUnassigned) return [...priorities, { sourceRef: '', timeout: 5000 }]
    return priorities
  }, [priorities, sourceRefs])

  const selectedRefs = useMemo(
    () => new Set(rows.map((r) => r.sourceRef).filter(Boolean)),
    [rows]
  )

  return (
    <Table size="sm" className="mb-0">
      <thead>
        <tr>
          <td style={{ width: '30px' }}>#</td>
          <td>Source</td>
          <td style={{ width: '140px' }}>Fallback after (ms)</td>
          <td style={{ width: '70px' }}>Enabled</td>
          <td style={{ width: '80px' }}>Order</td>
          <td></td>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ sourceRef, timeout }, index) => {
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

export default PrefsEditor
