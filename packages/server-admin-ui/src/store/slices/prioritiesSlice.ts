import type { StateCreator } from 'zustand'
import remove from 'lodash.remove'
import type {
  SourcePrioritiesData,
  SourcePriority,
  PathPriority,
  PriorityGroup,
  PriorityGroupsData
} from '../types'

function checkTimeouts(priorities: SourcePriority[]): boolean {
  return priorities.every((prio, i) => {
    if (i === 0) {
      return true
    }
    const value = Number(prio.timeout)
    // Allow -1 (disabled) or positive values
    return !Number.isNaN(value) && (value === -1 || value > 0)
  })
}

export interface PrioritiesSliceState {
  sourcePrioritiesData: SourcePrioritiesData
  priorityGroupsData: PriorityGroupsData
}

export interface PrioritiesSliceActions {
  setSourcePriorities: (priorities: Record<string, SourcePriority[]>) => void
  changePath: (index: number, path: string) => void
  deletePath: (index: number) => void
  changePriority: (
    pathIndex: number,
    index: number,
    sourceRef: string,
    timeout: string | number
  ) => void
  deletePriority: (pathIndex: number, index: number) => void
  movePriority: (pathIndex: number, index: number, change: 1 | -1) => void
  setSaving: () => void
  setSaved: () => void
  setSaveFailed: () => void
  clearSaveFailed: () => void
  setPriorityGroups: (groups: PriorityGroup[]) => void
  setPriorityGroupsFromServer: (groups: PriorityGroup[]) => void
  reorderGroupSources: (groupId: string, from: number, to: number) => void
  setGroupSources: (groupId: string, sources: string[]) => void
  setGroupsSaving: () => void
  setGroupsSaved: () => void
  setGroupsSaveFailed: () => void
  clearGroupsSaveFailed: () => void
}

export type PrioritiesSlice = PrioritiesSliceState & PrioritiesSliceActions

const initialPrioritiesState: PrioritiesSliceState = {
  sourcePrioritiesData: {
    sourcePriorities: [],
    saveState: {
      dirty: false,
      timeoutsOk: true
    }
  },
  priorityGroupsData: {
    groups: [],
    saveState: {
      dirty: false,
      timeoutsOk: true
    }
  }
}

export const createPrioritiesSlice: StateCreator<
  PrioritiesSlice,
  [],
  [],
  PrioritiesSlice
> = (set) => ({
  ...initialPrioritiesState,

  setSourcePriorities: (sourcePrioritiesMap) => {
    const sourcePriorities: PathPriority[] = Object.keys(
      sourcePrioritiesMap
    ).map((key) => ({
      path: key,
      priorities: sourcePrioritiesMap[key]
    }))
    set({
      sourcePrioritiesData: {
        sourcePriorities,
        saveState: {
          dirty: false,
          timeoutsOk: true
        }
      }
    })
  },

  changePath: (index, path) => {
    set((state) => {
      const sourcePriorities = [...state.sourcePrioritiesData.sourcePriorities]
      if (index === sourcePriorities.length) {
        sourcePriorities.push({ path: '', priorities: [] })
      }
      sourcePriorities[index] = { ...sourcePriorities[index], path }
      return {
        sourcePrioritiesData: {
          ...state.sourcePrioritiesData,
          sourcePriorities,
          saveState: { ...state.sourcePrioritiesData.saveState, dirty: true }
        }
      }
    })
  },

  deletePath: (index) => {
    set((state) => {
      const sourcePriorities = [...state.sourcePrioritiesData.sourcePriorities]
      remove(sourcePriorities, (_, i) => i === index)
      return {
        sourcePrioritiesData: {
          ...state.sourcePrioritiesData,
          sourcePriorities,
          saveState: { ...state.sourcePrioritiesData.saveState, dirty: true }
        }
      }
    })
  },

  changePriority: (pathIndex, index, sourceRef, timeout) => {
    set((state) => {
      const sourcePriorities = [...state.sourcePrioritiesData.sourcePriorities]
      if (pathIndex === sourcePriorities.length) {
        sourcePriorities.push({ path: '', priorities: [] })
      }
      const prios = [...sourcePriorities[pathIndex].priorities]
      if (index === prios.length) {
        prios.push({ sourceRef: '', timeout: index > 0 ? 5000 : '' })
      }
      prios[index] = { sourceRef, timeout }
      sourcePriorities[pathIndex] = {
        ...sourcePriorities[pathIndex],
        priorities: prios
      }

      const allTimeoutsOk = sourcePriorities.every((pp) =>
        checkTimeouts(pp.priorities)
      )
      return {
        sourcePrioritiesData: {
          ...state.sourcePrioritiesData,
          sourcePriorities,
          saveState: {
            ...state.sourcePrioritiesData.saveState,
            dirty: true,
            timeoutsOk: allTimeoutsOk
          }
        }
      }
    })
  },

  deletePriority: (pathIndex, index) => {
    set((state) => {
      const sourcePriorities = [...state.sourcePrioritiesData.sourcePriorities]
      if (pathIndex < 0 || pathIndex >= sourcePriorities.length) return state
      const prios = [...sourcePriorities[pathIndex].priorities]
      remove(prios, (_, i) => i === index)
      sourcePriorities[pathIndex] = {
        ...sourcePriorities[pathIndex],
        priorities: prios
      }

      const allTimeoutsOk = sourcePriorities.every((pp) =>
        checkTimeouts(pp.priorities)
      )
      return {
        sourcePrioritiesData: {
          ...state.sourcePrioritiesData,
          sourcePriorities,
          saveState: {
            ...state.sourcePrioritiesData.saveState,
            dirty: true,
            timeoutsOk: allTimeoutsOk
          }
        }
      }
    })
  },

  movePriority: (pathIndex, index, change) => {
    set((state) => {
      const sourcePriorities = [...state.sourcePrioritiesData.sourcePriorities]
      const prios = [...sourcePriorities[pathIndex].priorities]
      const target = index + change
      if (target < 0 || target >= prios.length) return state
      const tmp = prios[index]
      prios[index] = prios[target]
      prios[target] = tmp
      sourcePriorities[pathIndex] = {
        ...sourcePriorities[pathIndex],
        priorities: prios
      }

      const allTimeoutsOk = sourcePriorities.every((pp) =>
        checkTimeouts(pp.priorities)
      )
      return {
        sourcePrioritiesData: {
          ...state.sourcePrioritiesData,
          sourcePriorities,
          saveState: {
            ...state.sourcePrioritiesData.saveState,
            dirty: true,
            timeoutsOk: allTimeoutsOk
          }
        }
      }
    })
  },

  setSaving: () => {
    set((state) => ({
      sourcePrioritiesData: {
        ...state.sourcePrioritiesData,
        saveState: {
          ...state.sourcePrioritiesData.saveState,
          isSaving: true,
          saveFailed: false
        }
      }
    }))
  },

  setSaved: () => {
    set((state) => ({
      sourcePrioritiesData: {
        ...state.sourcePrioritiesData,
        saveState: {
          ...state.sourcePrioritiesData.saveState,
          dirty: false,
          isSaving: false,
          saveFailed: false
        }
      }
    }))
  },

  setSaveFailed: () => {
    set((state) => ({
      sourcePrioritiesData: {
        ...state.sourcePrioritiesData,
        saveState: {
          ...state.sourcePrioritiesData.saveState,
          isSaving: false,
          saveFailed: true
        }
      }
    }))
  },

  clearSaveFailed: () => {
    set((state) => ({
      sourcePrioritiesData: {
        ...state.sourcePrioritiesData,
        saveState: {
          ...state.sourcePrioritiesData.saveState,
          saveFailed: false
        }
      }
    }))
  },

  setPriorityGroups: (groups) => {
    set((state) => ({
      priorityGroupsData: {
        ...state.priorityGroupsData,
        groups,
        saveState: { ...state.priorityGroupsData.saveState, dirty: true }
      }
    }))
  },

  setPriorityGroupsFromServer: (groups) => {
    set({
      priorityGroupsData: {
        groups,
        saveState: { dirty: false, timeoutsOk: true }
      }
    })
  },

  reorderGroupSources: (groupId, from, to) => {
    set((state) => {
      const groups = state.priorityGroupsData.groups.map((g) => {
        if (g.id !== groupId) return g
        if (
          from < 0 ||
          to < 0 ||
          from >= g.sources.length ||
          to >= g.sources.length ||
          from === to
        ) {
          return g
        }
        const sources = [...g.sources]
        const [moved] = sources.splice(from, 1)
        sources.splice(to, 0, moved)
        return { ...g, sources }
      })
      return {
        priorityGroupsData: {
          ...state.priorityGroupsData,
          groups,
          saveState: { ...state.priorityGroupsData.saveState, dirty: true }
        }
      }
    })
  },

  setGroupSources: (groupId, sources) => {
    set((state) => {
      const existing = state.priorityGroupsData.groups.find(
        (g) => g.id === groupId
      )
      const groups = existing
        ? state.priorityGroupsData.groups.map((g) =>
            g.id === groupId ? { ...g, sources } : g
          )
        : [...state.priorityGroupsData.groups, { id: groupId, sources }]
      return {
        priorityGroupsData: {
          ...state.priorityGroupsData,
          groups,
          saveState: { ...state.priorityGroupsData.saveState, dirty: true }
        }
      }
    })
  },

  setGroupsSaving: () => {
    set((state) => ({
      priorityGroupsData: {
        ...state.priorityGroupsData,
        saveState: {
          ...state.priorityGroupsData.saveState,
          isSaving: true,
          saveFailed: false
        }
      }
    }))
  },

  setGroupsSaved: () => {
    set((state) => ({
      priorityGroupsData: {
        ...state.priorityGroupsData,
        saveState: {
          ...state.priorityGroupsData.saveState,
          dirty: false,
          isSaving: false,
          saveFailed: false
        }
      }
    }))
  },

  setGroupsSaveFailed: () => {
    set((state) => ({
      priorityGroupsData: {
        ...state.priorityGroupsData,
        saveState: {
          ...state.priorityGroupsData.saveState,
          isSaving: false,
          saveFailed: true
        }
      }
    }))
  },

  clearGroupsSaveFailed: () => {
    set((state) => ({
      priorityGroupsData: {
        ...state.priorityGroupsData,
        saveState: {
          ...state.priorityGroupsData.saveState,
          saveFailed: false
        }
      }
    }))
  }
})
