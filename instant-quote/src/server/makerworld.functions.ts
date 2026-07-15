import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  downloadMakerworldModel,
  type MakerworldErrorCode,
} from '@/lib/makerworld'

const makerworldSchema = z.object({
  designId: z.number().int().positive(),
  profileId: z.number().int().positive().optional(),
})

const ERROR_STATUS: Record<MakerworldErrorCode, number> = {
  token_missing: 503,
  design_not_found: 404,
  no_instance: 404,
  auth_expired: 401,
  too_large: 413,
  download_failed: 502,
}

// Returns the raw 3MF bytes on success (Response passthrough) or
// { code: MakerworldErrorCode } JSON with a matching status on failure.
export const fetchMakerworldModel = createServerFn({ method: 'POST' })
  .validator(makerworldSchema)
  .handler(async ({ data }) => {
    const token = process.env.BAMBU_CLOUD_TOKEN
    if (!token) {
      return Response.json({ code: 'token_missing' }, { status: 503 })
    }
    const result = await downloadMakerworldModel(data, token)
    if ('error' in result) {
      console.info('[makerworld] fetch failed', {
        designId: data.designId,
        code: result.error,
      })
      return Response.json(
        { code: result.error },
        { status: ERROR_STATUS[result.error] },
      )
    }
    console.info('[makerworld] fetched', {
      designId: data.designId,
      fileName: result.fileName,
      bytes: result.bytes.byteLength,
    })
    return new Response(result.bytes, {
      headers: {
        'content-type': 'application/octet-stream',
        // Header values must be latin-1; titles can be unicode.
        'x-mw-filename': encodeURIComponent(result.fileName),
      },
    })
  })
