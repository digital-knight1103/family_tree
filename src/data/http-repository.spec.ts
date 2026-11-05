import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FamilyData } from '@/domain/schema'
import { HttpFamilyRepository } from './http-repository'

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch(response: Response | Error) {
  const mock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', mock)
  return mock
}

const sampleData = { persons: [], unions: [] } as unknown as FamilyData

const base = (revision: number) => ({ revision, hash: `h${revision}` })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HttpFamilyRepository.load', () => {
  it('loads the demo seed when the file is missing', async () => {
    const fetchMock = stubFetch(jsonResponse(200, { kind: 'missing', filePath: 'x.json' }))
    const result = await new HttpFamilyRepository().load()
    expect(fetchMock).toHaveBeenCalledWith('/__data/family', {})
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.source).toBe('demo')
    expect(result.readOnly).toBe(true)
    expect(result.data.persons.length).toBeGreaterThanOrEqual(15)
  })

  it('returns user data as editable', async () => {
    stubFetch(jsonResponse(200, { kind: 'ok', data: sampleData, filePath: 'f.json', hash: 'h0' }))
    const result = await new HttpFamilyRepository().load()
    expect(result).toEqual({
      kind: 'ok',
      data: sampleData,
      source: 'user',
      readOnly: false,
      filePath: 'f.json',
      hash: 'h0',
    })
  })

  it('throws a Polish error when user data comes without a hash', async () => {
    stubFetch(jsonResponse(200, { kind: 'ok', data: sampleData, filePath: 'f.json' }))
    await expect(new HttpFamilyRepository().load()).rejects.toThrow(
      'Nie udało się wczytać danych z serwera deweloperskiego.',
    )
  })

  it('passes through an invalid file', async () => {
    const errors = [{ path: 'persons[0].id', message: 'Brak' }]
    stubFetch(jsonResponse(200, { kind: 'invalid', filePath: 'f.json', errors }))
    const result = await new HttpFamilyRepository().load()
    expect(result).toEqual({ kind: 'invalid', filePath: 'f.json', errors })
  })

  it('throws a Polish error on an unexpected status', async () => {
    stubFetch(jsonResponse(500, { error: 'x' }))
    await expect(new HttpFamilyRepository().load()).rejects.toThrow(
      'Nie udało się wczytać danych z serwera deweloperskiego.',
    )
  })

  it('throws a Polish error when the network fails', async () => {
    stubFetch(new TypeError('Failed to fetch'))
    await expect(new HttpFamilyRepository().load()).rejects.toThrow(
      /Nie udało się wczytać danych z serwera deweloperskiego\./,
    )
  })
})

describe('HttpFamilyRepository.save', () => {
  it('sends a JSON PUT with baseRevision and baseHash and returns the revision and hash', async () => {
    const fetchMock = stubFetch(jsonResponse(200, { revision: 7, hash: 'h7' }))
    const result = await new HttpFamilyRepository().save(sampleData, base(6))
    expect(result).toEqual({ kind: 'ok', revision: 7, hash: 'h7' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/__data/family')
    expect(init.method).toBe('PUT')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body as string)).toEqual({
      data: sampleData,
      baseRevision: 6,
      baseHash: 'h6',
    })
    expect(init.keepalive).toBeUndefined()
  })

  it('passes keepalive:true to fetch', async () => {
    const fetchMock = stubFetch(jsonResponse(200, { revision: 1, hash: 'h1' }))
    await new HttpFamilyRepository().save(sampleData, base(0), { keepalive: true })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.keepalive).toBe(true)
  })

  it('does not pass keepalive when it is false', async () => {
    const fetchMock = stubFetch(jsonResponse(200, { revision: 1, hash: 'h1' }))
    await new HttpFamilyRepository().save(sampleData, base(0), { keepalive: false })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.keepalive).toBeUndefined()
  })

  it('maps 409 to conflict', async () => {
    stubFetch(jsonResponse(409, { error: 'conflict' }))
    expect(await new HttpFamilyRepository().save(sampleData, base(1))).toEqual({ kind: 'conflict' })
  })

  it('maps 422 to an error naming the first validation error', async () => {
    stubFetch(
      jsonResponse(422, {
        errors: [
          { path: 'persons[0].id', message: 'Zły' },
          { path: 'other', message: 'Drugi' },
        ],
      }),
    )
    const result = await new HttpFamilyRepository().save(sampleData, base(1))
    expect(result).toEqual({
      kind: 'error',
      message: 'Dane nie przeszły walidacji: persons[0].id: Zły',
    })
  })

  it('maps 500 and network failure to non-empty errors', async () => {
    stubFetch(jsonResponse(500, { error: 'boom' }))
    const serverError = await new HttpFamilyRepository().save(sampleData, base(1))
    expect(serverError.kind).toBe('error')
    if (serverError.kind === 'error') expect(serverError.message).not.toBe('')

    stubFetch(new TypeError('Failed to fetch'))
    const offline = await new HttpFamilyRepository().save(sampleData, base(1))
    expect(offline).toEqual({ kind: 'error', message: 'Brak połączenia z serwerem deweloperskim.' })
  })

  it('gives distinct non-empty messages for 422, 423, 404 and 400', async () => {
    const messages: string[] = []
    for (const status of [422, 423, 404, 400]) {
      stubFetch(jsonResponse(status, { errors: [] }))
      const result = await new HttpFamilyRepository().save(sampleData, base(1))
      expect(result.kind).toBe('error')
      if (result.kind === 'error') {
        expect(result.message).not.toBe('')
        messages.push(result.message)
      }
    }
    expect(new Set(messages).size).toBe(4)
  })

  it('uses the corrupt-file message for 423', async () => {
    stubFetch(jsonResponse(423, { errors: [] }))
    expect(await new HttpFamilyRepository().save(sampleData, base(1))).toEqual({
      kind: 'error',
      message: 'Plik danych na dysku jest uszkodzony, zapis zablokowany.',
    })
  })

  it('uses the missing-file message for 404', async () => {
    stubFetch(jsonResponse(404))
    expect(await new HttpFamilyRepository().save(sampleData, base(1))).toEqual({
      kind: 'error',
      message: 'Brak pliku danych.',
    })
  })

  it('returns an error when a 200 response has no revision or no hash', async () => {
    stubFetch(jsonResponse(200, { hash: 'h2' }))
    expect((await new HttpFamilyRepository().save(sampleData, base(1))).kind).toBe('error')
    stubFetch(jsonResponse(200, { revision: 2 }))
    expect((await new HttpFamilyRepository().save(sampleData, base(1))).kind).toBe('error')
  })
})

describe('HttpFamilyRepository.createNew', () => {
  it('returns the created data as editable user data', async () => {
    const fetchMock = stubFetch(jsonResponse(201, { data: sampleData, hash: 'h0' }))
    const result = await new HttpFamilyRepository().createNew()
    expect(fetchMock).toHaveBeenCalledWith('/__data/family/new', { method: 'POST' })
    expect(result).toEqual({
      kind: 'ok',
      source: 'user',
      readOnly: false,
      data: sampleData,
      hash: 'h0',
    })
  })

  it('throws a Polish error when the created data comes without a hash', async () => {
    stubFetch(jsonResponse(201, { data: sampleData }))
    await expect(new HttpFamilyRepository().createNew()).rejects.toThrow(
      'Nie udało się utworzyć pliku danych.',
    )
  })

  it('falls back to load() when the file already exists', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(409, { error: 'exists' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { kind: 'ok', data: sampleData, filePath: 'f', hash: 'h0' }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const result = await new HttpFamilyRepository().createNew()
    expect(result).toMatchObject({ kind: 'ok', source: 'user', data: sampleData, hash: 'h0' })
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/__data/family/new',
      '/__data/family',
    ])
  })

  it('throws a Polish error on other statuses', async () => {
    stubFetch(jsonResponse(500, { error: 'x' }))
    await expect(new HttpFamilyRepository().createNew()).rejects.toThrow(
      'Nie udało się utworzyć pliku danych.',
    )
  })
})

describe('HttpFamilyRepository photos', () => {
  it('uploads the blob with its content type and returns the file name', async () => {
    const fetchMock = stubFetch(jsonResponse(200, { photo: 'p1.webp' }))
    const blob = new Blob(['x'], { type: 'image/png' })
    const photo = await new HttpFamilyRepository().uploadPhoto('p1', blob)
    expect(photo).toBe('p1.webp')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/__data/photos/p1')
    expect(init.method).toBe('PUT')
    expect(init.headers).toEqual({ 'Content-Type': 'image/png' })
    expect(init.body).toBe(blob)
  })

  it('throws a Polish error when the upload fails', async () => {
    stubFetch(jsonResponse(413))
    await expect(
      new HttpFamilyRepository().uploadPhoto('p1', new Blob(['x'], { type: 'image/png' })),
    ).rejects.toThrow('Nie udało się zapisać zdjęcia.')
  })

  it('deletes a photo with DELETE', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }))
    await new HttpFamilyRepository().deletePhoto('p1')
    expect(fetchMock).toHaveBeenCalledWith('/__data/photos/p1', { method: 'DELETE' })
  })

  it('throws a Polish error when the delete fails or the network is down', async () => {
    stubFetch(jsonResponse(500))
    await expect(new HttpFamilyRepository().deletePhoto('p1')).rejects.toThrow(
      'Nie udało się usunąć zdjęcia.',
    )
    stubFetch(new TypeError('Failed to fetch'))
    await expect(new HttpFamilyRepository().deletePhoto('p1')).rejects.toThrow(
      /Brak połączenia z serwerem deweloperskim\./,
    )
  })

  it('builds an encoded photo URL', () => {
    expect(new HttpFamilyRepository().photoUrl('a b.webp')).toBe('/__data/photos/a%20b.webp')
  })
})
