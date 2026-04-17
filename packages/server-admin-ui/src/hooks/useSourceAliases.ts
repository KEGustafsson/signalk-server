import { useCallback, useEffect } from 'react'
import { useStore } from '../store'
import { buildSourceLabel, type SourcesData } from '../utils/sourceLabels'

const LEGACY_STORAGE_KEY = 'admin.v1.sourceAliases'

let migrationDone = false

function migrateFromLocalStorage(
  serverAliases: Record<string, string>,
  loaded: boolean
): void {
  if (migrationDone || !loaded) return
  migrationDone = true

  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return
    const localAliases = JSON.parse(raw)
    if (
      !localAliases ||
      typeof localAliases !== 'object' ||
      Array.isArray(localAliases) ||
      Object.keys(localAliases).length === 0 ||
      !Object.values(localAliases).every((v) => typeof v === 'string')
    ) {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return
    }

    if (Object.keys(serverAliases).length === 0) {
      fetch(`${window.serverRoutesPrefix}/sourceAliases`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localAliases)
      })
        .then((res) => {
          if (res.ok) {
            useStore.getState().setSourceAliases(localAliases)
            localStorage.removeItem(LEGACY_STORAGE_KEY)
          } else {
            migrationDone = false
          }
        })
        .catch(() => {
          migrationDone = false
        })
    } else {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
  } catch {
    // Ignore localStorage errors
  }
}

function persistAliases(
  current: Record<string, string>,
  prev: Record<string, string>
): void {
  const revertOnFailure = () => {
    if (useStore.getState().sourceAliases === current) {
      useStore.getState().setSourceAliases(prev)
    }
  }
  fetch(`${window.serverRoutesPrefix}/sourceAliases`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(current)
  })
    .then((res) => {
      if (!res.ok) {
        console.error('Failed to save source aliases:', res.status)
        revertOnFailure()
      }
    })
    .catch((err) => {
      console.error('Failed to save source aliases:', err)
      revertOnFailure()
    })
}

export function useSourceAliases() {
  const aliases = useStore((s) => s.sourceAliases)
  const loaded = useStore((s) => s.sourceAliasesLoaded)

  useEffect(() => {
    migrateFromLocalStorage(aliases, loaded)
  }, [aliases, loaded])

  const setAlias = useCallback((sourceRef: string, alias: string) => {
    const prev = useStore.getState().sourceAliases
    const current = { ...prev }
    if (alias.trim()) {
      current[sourceRef] = alias.trim()
    } else {
      delete current[sourceRef]
    }
    useStore.getState().setSourceAliases(current)
    persistAliases(current, prev)
  }, [])

  const removeAlias = useCallback(
    (sourceRef: string) => setAlias(sourceRef, ''),
    [setAlias]
  )

  const getDisplayName = useCallback(
    (sourceRef: string, sourcesData?: SourcesData | null): string => {
      if (aliases[sourceRef]) return aliases[sourceRef]
      return buildSourceLabel(sourceRef, sourcesData ?? null)
    },
    [aliases]
  )

  return { aliases, setAlias, removeAlias, getDisplayName }
}
