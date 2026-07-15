import { describe, it, expect } from 'bun:test'
import {
  parseMakerworldUrl,
  pickProfileId,
  downloadMakerworldModel,
  MAKERWORLD_ERROR_MESSAGES,
  type MakerworldErrorCode,
} from '../src/lib/makerworld'
import { MAX_FILE_BYTES } from '../src/lib/upload'

describe('parseMakerworldUrl', () => {
  it('parses a canonical model URL with locale and slug', () => {
    expect(
      parseMakerworldUrl('https://makerworld.com/en/models/123456-cool-benchy'),
    ).toEqual({ designId: 123456 })
  })
  it('parses other locales', () => {
    expect(
      parseMakerworldUrl('https://makerworld.com/de/models/98765'),
    ).toEqual({
      designId: 98765,
    })
    expect(
      parseMakerworldUrl('https://makerworld.com/zh-tw/models/42-widget'),
    ).toEqual({ designId: 42 })
  })
  it('parses without a locale prefix', () => {
    expect(parseMakerworldUrl('https://makerworld.com/models/123')).toEqual({
      designId: 123,
    })
  })
  it('parses scheme-less and www. inputs', () => {
    expect(parseMakerworldUrl('makerworld.com/en/models/123')).toEqual({
      designId: 123,
    })
    expect(
      parseMakerworldUrl('https://www.makerworld.com/en/models/123'),
    ).toEqual({ designId: 123 })
  })
  it('tolerates trailing slash and query string', () => {
    expect(
      parseMakerworldUrl('https://makerworld.com/en/models/123-x/?from=search'),
    ).toEqual({ designId: 123 })
  })
  it('extracts profileId from the fragment', () => {
    expect(
      parseMakerworldUrl(
        'https://makerworld.com/en/models/123-x#profileId-456',
      ),
    ).toEqual({ designId: 123, profileId: 456 })
  })
  it('rejects non-makerworld hosts', () => {
    expect(
      parseMakerworldUrl('https://www.thingiverse.com/thing:123'),
    ).toBeNull()
  })
  it('rejects non-model makerworld pages', () => {
    expect(
      parseMakerworldUrl('https://makerworld.com/en/collections/1-api'),
    ).toBeNull()
    expect(parseMakerworldUrl('https://makerworld.com/en/@someone')).toBeNull()
  })
  it('rejects non-numeric ids and garbage', () => {
    expect(
      parseMakerworldUrl('https://makerworld.com/en/models/abc-def'),
    ).toBeNull()
    expect(parseMakerworldUrl('')).toBeNull()
    expect(parseMakerworldUrl('not a url at all')).toBeNull()
  })
})

// Instances carry two ids: `id` (the instance, used in defaultInstanceId and
// URL fragments) and `profileId` (what the iot-service download endpoint
// wants). pickProfileId resolves either to the downloadable profileId.
describe('pickProfileId', () => {
  const instances = [
    { id: 2, profileId: 200 },
    { id: 3, profileId: 300 },
  ]
  it('maps a requested instance id to its profileId', () => {
    expect(pickProfileId({ defaultInstanceId: 2, instances }, 3)).toBe(300)
  })
  it('passes a requested id through raw when no instance matches (fragment may already be a profileId)', () => {
    expect(pickProfileId({ defaultInstanceId: 2, instances }, 999)).toBe(999)
  })
  it('resolves defaultInstanceId to its profileId', () => {
    expect(pickProfileId({ defaultInstanceId: 3, instances })).toBe(300)
  })
  it('falls back to the first instance when defaultInstanceId matches nothing', () => {
    expect(pickProfileId({ defaultInstanceId: 0, instances })).toBe(200)
    expect(pickProfileId({ defaultInstanceId: 7, instances })).toBe(200)
  })
  it('returns null when there are no instances, even with a defaultInstanceId', () => {
    expect(pickProfileId({ defaultInstanceId: 7, instances: [] })).toBeNull()
    expect(pickProfileId({})).toBeNull()
  })
})

interface FetchCall {
  url: string
  init?: RequestInit
}

// Scripted fetch: matches request URLs by substring, records every call.
function makeFetch(
  routes: Array<{ match: string; response: () => Response }>,
  calls: FetchCall[] = [],
): { fetchImpl: typeof fetch; calls: FetchCall[] } {
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    calls.push({ url, init })
    const route = routes.find((r) => url.includes(r.match))
    if (!route) throw new Error(`unexpected fetch: ${url}`)
    return route.response()
  }) as typeof fetch
  return { fetchImpl, calls }
}

const PRESIGNED =
  'https://s3.us-west-1.amazonaws.com/mw/file.3mf?at=abc&exp=123&key=q%2Bw'

function designJson(overrides: Record<string, unknown> = {}) {
  return {
    id: 123,
    title: 'Cool Boat',
    modelId: 'US2bb73b106683e5',
    defaultInstanceId: 77,
    instances: [
      { id: 77, profileId: 770 },
      { id: 78, profileId: 780 },
    ],
    ...overrides,
  }
}

const bytes = new Uint8Array([80, 75, 3, 4, 9, 9])

function happyRoutes(profileName = 'Benchy 0.2mm.3mf') {
  return [
    {
      match: '/design-service/design/123',
      response: () => Response.json(designJson()),
    },
    {
      match: '/iot-service/api/user/profile/770',
      response: () => Response.json({ url: PRESIGNED, name: profileName }),
    },
    {
      match: 's3.us-west-1.amazonaws.com',
      response: () => new Response(bytes),
    },
  ]
}

describe('downloadMakerworldModel', () => {
  it('runs the 3-step flow and returns bytes with a .3mf name', async () => {
    const { fetchImpl, calls } = makeFetch(happyRoutes())
    const result = await downloadMakerworldModel(
      { designId: 123 },
      'tok-abc',
      fetchImpl,
    )
    if ('error' in result) throw new Error(`unexpected error: ${result.error}`)
    expect(new Uint8Array(result.bytes)).toEqual(bytes)
    expect(result.fileName).toBe('Benchy 0.2mm.3mf')

    expect(calls[0]!.url).toBe(
      'https://api.bambulab.com/v1/design-service/design/123',
    )
    expect(calls[1]!.url).toBe(
      'https://api.bambulab.com/v1/iot-service/api/user/profile/770?model_id=US2bb73b106683e5',
    )
    expect(new Headers(calls[1]!.init?.headers).get('authorization')).toBe(
      'Bearer tok-abc',
    )
    // Presigned URL must be fetched verbatim, without following redirects.
    expect(calls[2]!.url).toBe(PRESIGNED)
    expect(calls[2]!.init?.redirect).toBe('manual')
  })

  it('maps the requested instance id from the ref to its profileId', async () => {
    const routes = happyRoutes()
    routes[1] = {
      match: '/iot-service/api/user/profile/780',
      response: () => Response.json({ url: PRESIGNED, name: 'x.3mf' }),
    }
    const { fetchImpl, calls } = makeFetch(routes)
    const result = await downloadMakerworldModel(
      { designId: 123, profileId: 78 },
      't',
      fetchImpl,
    )
    expect('error' in result).toBe(false)
    expect(calls[1]!.url).toContain('/profile/780?')
  })

  it('appends .3mf to profile names missing the extension', async () => {
    const { fetchImpl } = makeFetch(happyRoutes('Benchy'))
    const result = await downloadMakerworldModel(
      { designId: 123 },
      't',
      fetchImpl,
    )
    if ('error' in result) throw new Error(result.error)
    expect(result.fileName).toBe('Benchy.3mf')
  })

  it('falls back to design title, then a synthetic name', async () => {
    const routes = happyRoutes('')
    const { fetchImpl } = makeFetch(routes)
    const result = await downloadMakerworldModel(
      { designId: 123 },
      't',
      fetchImpl,
    )
    if ('error' in result) throw new Error(result.error)
    expect(result.fileName).toBe('Cool Boat.3mf')

    routes[0] = {
      match: '/design-service/design/123',
      response: () => Response.json(designJson({ title: '' })),
    }
    const { fetchImpl: f2 } = makeFetch(routes)
    const r2 = await downloadMakerworldModel({ designId: 123 }, 't', f2)
    if ('error' in r2) throw new Error(r2.error)
    expect(r2.fileName).toBe('makerworld-123.3mf')
  })

  it('reports design_not_found for id:0 responses and non-200s', async () => {
    const { fetchImpl } = makeFetch([
      {
        match: '/design-service/design/123',
        response: () => Response.json(designJson({ id: 0 })),
      },
    ])
    expect(
      await downloadMakerworldModel({ designId: 123 }, 't', fetchImpl),
    ).toEqual({ error: 'design_not_found' })

    const { fetchImpl: f2 } = makeFetch([
      {
        match: '/design-service/design/123',
        response: () => new Response('nope', { status: 404 }),
      },
    ])
    expect(await downloadMakerworldModel({ designId: 123 }, 't', f2)).toEqual({
      error: 'design_not_found',
    })
  })

  it('reports no_instance when nothing is downloadable', async () => {
    const { fetchImpl } = makeFetch([
      {
        match: '/design-service/design/123',
        response: () =>
          Response.json(designJson({ defaultInstanceId: 0, instances: [] })),
      },
    ])
    expect(
      await downloadMakerworldModel({ designId: 123 }, 't', fetchImpl),
    ).toEqual({ error: 'no_instance' })

    const { fetchImpl: f2 } = makeFetch([
      {
        match: '/design-service/design/123',
        response: () => Response.json(designJson({ modelId: '' })),
      },
    ])
    expect(await downloadMakerworldModel({ designId: 123 }, 't', f2)).toEqual({
      error: 'no_instance',
    })
  })

  it('reports auth_expired on 401 from the profile endpoint', async () => {
    const routes = happyRoutes()
    routes[1] = {
      match: '/iot-service/api/user/profile/77',
      response: () => new Response('unauthorized', { status: 401 }),
    }
    const { fetchImpl } = makeFetch(routes)
    expect(
      await downloadMakerworldModel({ designId: 123 }, 't', fetchImpl),
    ).toEqual({ error: 'auth_expired' })
  })

  it('reports download_failed on other profile/S3 failures', async () => {
    const routes = happyRoutes()
    routes[1] = {
      match: '/iot-service/api/user/profile/77',
      response: () => Response.json({ name: 'x' }), // missing url
    }
    const { fetchImpl } = makeFetch(routes)
    expect(
      await downloadMakerworldModel({ designId: 123 }, 't', fetchImpl),
    ).toEqual({ error: 'download_failed' })

    const routes2 = happyRoutes()
    routes2[2] = {
      match: 's3.us-west-1.amazonaws.com',
      response: () => new Response('denied', { status: 403 }),
    }
    const { fetchImpl: f2 } = makeFetch(routes2)
    expect(await downloadMakerworldModel({ designId: 123 }, 't', f2)).toEqual({
      error: 'download_failed',
    })
  })

  it('reports too_large when content-length exceeds the upload limit', async () => {
    const routes = happyRoutes()
    routes[2] = {
      match: 's3.us-west-1.amazonaws.com',
      response: () =>
        new Response(bytes, {
          headers: { 'content-length': String(MAX_FILE_BYTES + 1) },
        }),
    }
    const { fetchImpl } = makeFetch(routes)
    expect(
      await downloadMakerworldModel({ designId: 123 }, 't', fetchImpl),
    ).toEqual({ error: 'too_large' })
  })
})

describe('MAKERWORLD_ERROR_MESSAGES', () => {
  it('has a user-facing message for every error code', () => {
    const codes: MakerworldErrorCode[] = [
      'token_missing',
      'design_not_found',
      'no_instance',
      'auth_expired',
      'download_failed',
      'too_large',
    ]
    for (const code of codes) {
      expect(MAKERWORLD_ERROR_MESSAGES[code]).toBeTruthy()
    }
  })
})
