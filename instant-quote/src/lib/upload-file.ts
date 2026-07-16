// Background upload of a parsed model to object storage (plan 02). Runs after
// mesh analysis so it never blocks the quote; failure is non-fatal here and
// only gates ordering later (plan 05).

import { api } from '@/lib/api/client'
import type { FileKind } from '@/lib/upload'
import { track } from '@/lib/funnel'

// uploadFile reserves a storage slot (deduping by hash), PUTs the bytes to the
// presigned URL when needed, confirms, and resolves to the stored file id.
export async function uploadFile(
  file: File,
  sha256: string,
  kind: Exclude<FileKind, 'unsupported'>,
): Promise<string> {
  track('file_upload_started', { fileName: file.name, kind, sizeBytes: file.size })

  const created = await api.POST('/api/v1/files', {
    body: { sha256, fileName: file.name, kind, sizeBytes: file.size },
  })
  if (!created.data) throw new Error('reserve upload failed')

  if (!created.data.alreadyStored && created.data.uploadUrl) {
    // Presigned PUT bypasses the typed client (raw bytes, cross-origin to MinIO).
    const put = await fetch(created.data.uploadUrl, { method: 'PUT', body: file })
    if (!put.ok) throw new Error(`upload PUT failed (${put.status})`)

    const confirmed = await api.POST('/api/v1/files/{fileId}/confirm', {
      params: { path: { fileId: created.data.fileId } },
    })
    if (!confirmed.data?.stored) throw new Error('confirm upload failed')
  }

  track('file_upload_succeeded', { fileName: file.name })
  return created.data.fileId
}
