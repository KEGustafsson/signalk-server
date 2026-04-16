import Badge from 'react-bootstrap/Badge'
import SourceLabel from './SourceLabel'
import type { SourcesData } from '../../utils/sourceLabels'

interface SourceGroupHeaderProps {
  sourceRef: string
  pathCount: number
  sourcesData: SourcesData | null
  showContext: boolean
}

function SourceGroupHeader({
  sourceRef,
  pathCount,
  sourcesData,
  showContext
}: SourceGroupHeaderProps) {
  const colSpan = showContext ? 5 : 4
  return (
    <div
      className="virtual-table-row source-group-header"
      style={{
        gridColumn: `1 / span ${colSpan}`,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 10px',
        backgroundColor: 'var(--bs-secondary-bg, #e2e6ea)',
        borderBottom: '2px solid var(--bs-border-color, #c2cfd6)',
        borderTop: '1px solid var(--bs-border-color, #c2cfd6)',
        fontWeight: 700,
        fontSize: '1rem'
      }}
    >
      <SourceLabel sourceRef={sourceRef} sourcesData={sourcesData} />
      <Badge bg="secondary" style={{ fontSize: '0.7em', fontWeight: 'normal' }}>
        {pathCount}
      </Badge>
    </div>
  )
}

export default SourceGroupHeader
