/// <reference lib="webworker" />
// Mesh analysis worker. Keeps all geometry math off the main thread.
// Only imports DOM-free modules (STL/OBJ/STEP parsers + analyze). 3MF is
// parsed on the main thread and arrives here as pre-parsed positions. The
// occt-import-js WASM (~10 MB) that tessellates STEP loads lazily on the
// first STEP file, so mesh uploads never pay for it.

import { parseStl, MeshParseError } from '../lib/mesh/parse-stl'
import { parseObj } from '../lib/mesh/parse-obj'
import { parseStep, type OcctModule } from '../lib/mesh/parse-step'
import { analyze } from '../lib/mesh/analyze'
import type { WorkerRequest, WorkerResponse } from '../lib/mesh/types'
import occtWasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url'

let occtPromise: Promise<OcctModule> | null = null

function loadOcct(): Promise<OcctModule> {
  occtPromise ??= import('occt-import-js').then(({ default: occtimportjs }) =>
    occtimportjs({ locateFile: () => occtWasmUrl }),
  )
  return occtPromise
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data
  try {
    // Hash the original bytes before we transfer/replace anything.
    const hash = await sha256Hex(req.buffer)

    let positions: Float32Array
    if (req.format === 'stl') {
      positions = parseStl(req.buffer)
    } else if (req.format === 'obj') {
      positions = parseObj(req.buffer)
    } else if (req.format === 'step') {
      positions = parseStep(req.buffer, await loadOcct())
    } else {
      positions = new Float32Array(req.buffer)
    }

    const metrics = analyze(positions)

    const response: WorkerResponse = {
      id: req.id,
      ok: true,
      metrics,
      hash,
      positions: positions.buffer as ArrayBuffer,
    }
    self.postMessage(response, { transfer: [response.positions] })
  } catch (err) {
    const code = err instanceof MeshParseError ? err.code : 'corrupt'
    const message =
      err instanceof Error ? err.message : 'Failed to analyze mesh.'
    const response: WorkerResponse = {
      id: req.id,
      ok: false,
      error: { code, message },
    }
    self.postMessage(response)
  }
}
