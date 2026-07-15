import {
  createContext,
  useContext,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import type { MeshMetrics } from '@/lib/mesh/types'
import type { PartConfig } from '@/lib/api/client'
import {
  classifyFile,
  MAX_FILE_BYTES,
  MAX_PARTS,
  type FileKind,
} from '@/lib/upload'
import {
  parseMakerworldUrl,
  MAKERWORLD_ERROR_MESSAGES,
  type MakerworldErrorCode,
} from '@/lib/makerworld'
import { useMeshWorker } from '@/hooks/useMeshWorker'
import { track } from '@/lib/funnel'
import { strings } from '@/lib/strings'

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
  | { type: 'clear' }

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
    case 'clear':
      return []
    default:
      return state
  }
}

interface PartsContextValue {
  parts: Part[]
  /** Validates, adds and parses files; resolves to the ids actually added. */
  handleFiles: (files: File[]) => Promise<string[]>
  /** Paste-a-MakerWorld-link intake; resolves to the ids actually added. */
  handleMakerworldUrl: (url: string) => Promise<string[]>
  mwPending: boolean
  updateConfig: (id: string, config: Partial<PartConfig>) => void
  remove: (id: string) => void
  clear: () => void
}

const PartsContext = createContext<PartsContextValue | null>(null)

/**
 * Owns the parts list and the whole intake pipeline (validation, toasts,
 * funnel events, mesh worker, MakerWorld fetch). Lives above the router so
 * parsing survives the landing → /quote navigation and parts persist while
 * moving between routes.
 */
export function PartsProvider({ children }: { children: ReactNode }) {
  const [parts, dispatch] = useReducer(reducer, [])
  const [mwPending, setMwPending] = useState(false)
  const { analyze } = useMeshWorker()

  async function handleFiles(files: File[]): Promise<string[]> {
    const added: string[] = []
    let slots = MAX_PARTS - parts.length
    for (const file of files) {
      if (slots <= 0) {
        toast.error(strings.errors.tooManyParts)
        break
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(strings.errors.tooLarge, { description: file.name })
        continue
      }
      const kind = classifyFile(file.name)
      if (kind === 'unsupported') {
        toast.error(strings.errors.unsupported, { description: file.name })
        continue
      }
      slots -= 1
      track('upload_started', {
        fileName: file.name,
        kind,
        sizeBytes: file.size,
      })
      const id = crypto.randomUUID()
      dispatch({
        type: 'add',
        id,
        fileName: file.name,
        fileSize: file.size,
        fileKind: kind,
      })
      added.push(id)

      analyze(file)
        .then((res) => {
          dispatch({
            type: 'parsed',
            id,
            hash: res.hash,
            metrics: res.metrics,
            positions: res.positions,
          })
          track('parse_succeeded', {
            fileName: file.name,
            volumeCm3: res.metrics.volumeCm3,
            triangles: res.metrics.triangleCount,
          })
          track('quote_shown', { fileName: file.name })
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : strings.errors.parseFailed
          dispatch({ type: 'failed', id, code: 'parse', message })
          track('parse_failed', { fileName: file.name, message })
          toast.error(strings.errors.corrupt, { description: file.name })
        })
    }
    return added
  }

  // The backend downloads the 3MF (browser CORS rules out a direct fetch),
  // then the bytes re-enter the normal pipeline as a synthesized File. Raw
  // fetch instead of the typed client: the success body is binary.
  async function handleMakerworldUrl(url: string): Promise<string[]> {
    const ref = parseMakerworldUrl(url)
    if (!ref) {
      toast.error(strings.errors.mwInvalidUrl)
      return []
    }
    setMwPending(true)
    track('makerworld_fetch_started', { ...ref })
    try {
      const res = await fetch('/api/v1/makerworld/fetch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(ref),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          code?: MakerworldErrorCode
        } | null
        track('makerworld_fetch_failed', { ...ref, code: body?.code })
        toast.error(
          (body?.code && MAKERWORLD_ERROR_MESSAGES[body.code]) ??
            strings.errors.mwDownloadFailed,
        )
        return []
      }
      const buf = await res.arrayBuffer()
      const name =
        decodeURIComponent(res.headers.get('x-mw-filename') ?? '') ||
        `makerworld-${ref.designId}.3mf`
      track('makerworld_fetch_succeeded', { ...ref, sizeBytes: buf.byteLength })
      return await handleFiles([new File([buf], name, { type: 'model/3mf' })])
    } catch {
      track('makerworld_fetch_failed', { ...ref, code: 'network' })
      toast.error(strings.errors.mwDownloadFailed)
      return []
    } finally {
      setMwPending(false)
    }
  }

  const value: PartsContextValue = {
    parts,
    handleFiles,
    handleMakerworldUrl,
    mwPending,
    updateConfig: (id, config) =>
      dispatch({ type: 'updateConfig', id, config }),
    remove: (id) => dispatch({ type: 'remove', id }),
    clear: () => dispatch({ type: 'clear' }),
  }

  return <PartsContext.Provider value={value}>{children}</PartsContext.Provider>
}

export function useParts(): PartsContextValue {
  const ctx = useContext(PartsContext)
  if (!ctx) throw new Error('useParts must be used within PartsProvider')
  return ctx
}
