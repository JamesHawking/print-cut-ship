import { useReducer } from 'react'
import type { MeshMetrics } from '@/lib/mesh/types'
import type { PartConfig } from '@/lib/pricing'
import { classifyFile, type FileKind } from '@/lib/upload'

export interface Part {
  id: string
  fileName: string
  fileSize: number
  kind: 'mesh' | 'step'
  status: 'parsing' | 'ready' | 'error'
  hash?: string
  metrics?: MeshMetrics
  positions?: Float32Array
  config: PartConfig
  error?: { code: string; message: string }
}

const DEFAULT_CONFIG: PartConfig = {
  process: 'pla',
  quantity: 1,
  leadTime: 'standard',
}

type Action =
  | {
      type: 'add'
      id: string
      fileName: string
      fileSize: number
      fileKind: FileKind
    }
  | {
      type: 'parsed'
      id: string
      hash: string
      metrics: MeshMetrics
      positions: Float32Array
    }
  | { type: 'failed'; id: string; code: string; message: string }
  | { type: 'updateConfig'; id: string; config: Partial<PartConfig> }
  | { type: 'remove'; id: string }

function reducer(state: Part[], action: Action): Part[] {
  switch (action.type) {
    case 'add':
      return [
        ...state,
        {
          id: action.id,
          fileName: action.fileName,
          fileSize: action.fileSize,
          kind: action.fileKind === 'step' ? 'step' : 'mesh',
          status: 'parsing',
          config: { ...DEFAULT_CONFIG },
        },
      ]
    case 'parsed':
      return state.map((p) =>
        p.id === action.id
          ? {
              ...p,
              status: 'ready',
              hash: action.hash,
              metrics: action.metrics,
              positions: action.positions,
            }
          : p,
      )
    case 'failed':
      return state.map((p) =>
        p.id === action.id
          ? {
              ...p,
              status: 'error',
              error: { code: action.code, message: action.message },
            }
          : p,
      )
    case 'updateConfig':
      return state.map((p) =>
        p.id === action.id
          ? { ...p, config: { ...p.config, ...action.config } }
          : p,
      )
    case 'remove':
      return state.filter((p) => p.id !== action.id)
    default:
      return state
  }
}

export function useParts() {
  const [parts, dispatch] = useReducer(reducer, [])

  const addFile = (file: File): string => {
    const id = crypto.randomUUID()
    dispatch({
      type: 'add',
      id,
      fileName: file.name,
      fileSize: file.size,
      fileKind: classifyFile(file.name),
    })
    return id
  }
  const markParsed = (
    id: string,
    hash: string,
    metrics: MeshMetrics,
    positions: Float32Array,
  ) => dispatch({ type: 'parsed', id, hash, metrics, positions })
  const markFailed = (id: string, code: string, message: string) =>
    dispatch({ type: 'failed', id, code, message })
  const updateConfig = (id: string, config: Partial<PartConfig>) =>
    dispatch({ type: 'updateConfig', id, config })
  const remove = (id: string) => dispatch({ type: 'remove', id })

  return { parts, addFile, markParsed, markFailed, updateConfig, remove }
}
