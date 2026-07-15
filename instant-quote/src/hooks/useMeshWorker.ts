import { useEffect, useRef } from 'react'
import type {
  MeshMetrics,
  WorkerRequest,
  WorkerResponse,
  WorkerErrorCode,
} from '@/lib/mesh/types'
import { classifyFile } from '@/lib/upload'
import { parse3mf } from '@/lib/mesh/parse-3mf'

export interface AnalyzeResult {
  metrics: MeshMetrics
  hash: string
  positions: Float32Array
}

export class AnalyzeError extends Error {
  constructor(
    public code: WorkerErrorCode,
    message: string,
  ) {
    super(message)
  }
}

/**
 * Lazily creates the mesh worker (client-only) and exposes a promise-based
 * analyze() for a File. STL/OBJ/STEP bytes go straight to the worker; 3MF is
 * parsed on the main thread first (DOMParser), then its positions go to the
 * worker for the math.
 */
export function useMeshWorker() {
  const workerRef = useRef<Worker | null>(null)
  const pending = useRef(
    new Map<
      string,
      { resolve: (r: AnalyzeResult) => void; reject: (e: AnalyzeError) => void }
    >(),
  )

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/mesh.worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const res = event.data
      const entry = pending.current.get(res.id)
      if (!entry) return
      pending.current.delete(res.id)
      if (res.ok) {
        entry.resolve({
          metrics: res.metrics,
          hash: res.hash,
          positions: new Float32Array(res.positions),
        })
      } else {
        entry.reject(new AnalyzeError(res.error.code, res.error.message))
      }
    }
    workerRef.current = worker
    const pendingMap = pending.current
    return () => {
      worker.terminate()
      workerRef.current = null
      pendingMap.clear()
    }
  }, [])

  async function analyze(file: File): Promise<AnalyzeResult> {
    const worker = workerRef.current
    if (!worker) throw new AnalyzeError('corrupt', 'Worker not ready.')

    const kind = classifyFile(file.name)
    const id = crypto.randomUUID()
    const arrayBuffer = await file.arrayBuffer()

    let request: WorkerRequest
    if (kind === '3mf') {
      // Parse 3MF on the main thread, send flattened positions to the worker.
      const positions = parse3mf(arrayBuffer)
      request = {
        id,
        format: 'positions',
        buffer: positions.buffer as ArrayBuffer,
        fileName: file.name,
      }
    } else if (kind === 'stl' || kind === 'obj' || kind === 'step') {
      request = { id, format: kind, buffer: arrayBuffer, fileName: file.name }
    } else {
      throw new AnalyzeError('unsupported', 'Unsupported format for analysis.')
    }

    return new Promise<AnalyzeResult>((resolve, reject) => {
      pending.current.set(id, { resolve, reject })
      worker.postMessage(request, { transfer: [request.buffer] })
    })
  }

  return { analyze }
}
