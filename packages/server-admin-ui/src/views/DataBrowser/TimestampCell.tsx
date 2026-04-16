import { useRef, useEffect, useState } from 'react'

interface TimestampCellProps {
  timestamp: string
  isPaused: boolean
  className?: string
}

function TimestampCell({ timestamp, isPaused, className }: TimestampCellProps) {
  const prevTimestampRef = useRef(timestamp)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (isPaused) return
    if (timestamp !== prevTimestampRef.current) {
      prevTimestampRef.current = timestamp
      setAnimate(true)
      const timer = setTimeout(() => setAnimate(false), 15000)
      return () => clearTimeout(timer)
    }
  }, [timestamp, isPaused])

  const cellClass = `virtual-table-cell timestamp-cell ${className || ''} ${
    animate ? 'timestamp-updated' : ''
  }`

  return (
    <div className={cellClass} data-label="Time">
      {timestamp}
    </div>
  )
}

export default TimestampCell
