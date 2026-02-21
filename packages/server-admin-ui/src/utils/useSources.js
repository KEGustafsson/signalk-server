import { useState, useEffect } from 'react'

export function fetchSourcesData() {
  return fetch('/signalk/v1/api/sources', {
    credentials: 'include'
  }).then((response) => response.json())
}

export function useSources(pollInterval = 30000) {
  const [sources, setSources] = useState({})

  useEffect(() => {
    let canceled = false

    const doFetch = () => {
      fetchSourcesData()
        .then((data) => {
          if (!canceled) {
            setSources(data)
          }
        })
        .catch(() => undefined)
    }

    doFetch()
    const interval = setInterval(doFetch, pollInterval)

    return () => {
      canceled = true
      clearInterval(interval)
    }
  }, [pollInterval])

  return sources
}
