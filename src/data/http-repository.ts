import type { FamilyData } from '@/domain/schema'
import type { ValidationError } from '@/domain/validate'
import { loadSeed, type FamilyRepository, type LoadResult, type SaveResult } from './repository'

const BASE = '/__data'

const MESSAGES = {
  load: 'Nie udało się wczytać danych z serwera deweloperskiego.',
  network: 'Brak połączenia z serwerem deweloperskim.',
  saveGeneric: 'Nie udało się zapisać danych.',
  corrupt: 'Plik danych na dysku jest uszkodzony, zapis zablokowany.',
  noFile: 'Brak pliku danych.',
  create: 'Nie udało się utworzyć pliku danych.',
  upload: 'Nie udało się zapisać zdjęcia.',
  delete: 'Nie udało się usunąć zdjęcia.',
}

type LoadResponse =
  | { kind: 'ok'; data: FamilyData; filePath?: string }
  | { kind: 'missing'; filePath?: string }
  | { kind: 'invalid'; filePath: string; errors: ValidationError[] }

async function request(url: string, init: RequestInit, failure: string): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    throw new Error(`${failure} ${MESSAGES.network}`)
  }
}

async function readJson<T>(response: Response): Promise<T | undefined> {
  try {
    return (await response.json()) as T
  } catch {
    return undefined
  }
}

export class HttpFamilyRepository implements FamilyRepository {
  async load(): Promise<LoadResult> {
    const response = await request(`${BASE}/family`, {}, MESSAGES.load)
    if (response.status !== 200) throw new Error(MESSAGES.load)
    const body = await readJson<LoadResponse>(response)
    if (!body) throw new Error(MESSAGES.load)
    if (body.kind === 'ok') {
      return {
        kind: 'ok',
        data: body.data,
        source: 'user',
        readOnly: false,
        filePath: body.filePath,
      }
    }
    if (body.kind === 'invalid') {
      return { kind: 'invalid', filePath: body.filePath, errors: body.errors }
    }
    if (body.kind === 'missing') return loadSeed()
    throw new Error(MESSAGES.load)
  }

  async save(
    data: FamilyData,
    baseRevision: number,
    opts?: { keepalive?: boolean },
  ): Promise<SaveResult> {
    let response: Response
    try {
      response = await fetch(`${BASE}/family`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, baseRevision }),
        ...(opts?.keepalive === true ? { keepalive: true } : {}),
      })
    } catch {
      return { kind: 'error', message: MESSAGES.network }
    }
    switch (response.status) {
      case 200: {
        const body = await readJson<{ revision: number }>(response)
        if (typeof body?.revision !== 'number') {
          return { kind: 'error', message: MESSAGES.saveGeneric }
        }
        return { kind: 'ok', revision: body.revision }
      }
      case 409:
        return { kind: 'conflict' }
      case 422: {
        const body = await readJson<{ errors?: ValidationError[] }>(response)
        const first = body?.errors?.[0]
        const detail = first ? `${first.path}: ${first.message}` : ''
        return { kind: 'error', message: `Dane nie przeszły walidacji: ${detail}`.trimEnd() }
      }
      case 423:
        return { kind: 'error', message: MESSAGES.corrupt }
      case 404:
        return { kind: 'error', message: MESSAGES.noFile }
      default:
        return { kind: 'error', message: MESSAGES.saveGeneric }
    }
  }

  async createNew(): Promise<LoadResult> {
    const response = await request(`${BASE}/family/new`, { method: 'POST' }, MESSAGES.create)
    if (response.status === 201) {
      const body = await readJson<{ data: FamilyData; filePath?: string }>(response)
      if (!body) throw new Error(MESSAGES.create)
      return {
        kind: 'ok',
        data: body.data,
        source: 'user',
        readOnly: false,
        filePath: body.filePath,
      }
    }
    if (response.status === 409) {
      const body = await readJson<{ error?: string }>(response)
      if (body?.error === 'exists') return this.load()
    }
    throw new Error(MESSAGES.create)
  }

  async uploadPhoto(personId: string, file: Blob): Promise<string> {
    const response = await request(
      `${BASE}/photos/${encodeURIComponent(personId)}`,
      { method: 'PUT', headers: { 'Content-Type': file.type }, body: file },
      MESSAGES.upload,
    )
    if (response.status !== 200) throw new Error(MESSAGES.upload)
    const body = await readJson<{ photo: string }>(response)
    if (typeof body?.photo !== 'string') throw new Error(MESSAGES.upload)
    return body.photo
  }

  async deletePhoto(personId: string): Promise<void> {
    const response = await request(
      `${BASE}/photos/${encodeURIComponent(personId)}`,
      { method: 'DELETE' },
      MESSAGES.delete,
    )
    if (response.status !== 204) throw new Error(MESSAGES.delete)
  }

  photoUrl(photo: string): string {
    return `${BASE}/photos/${encodeURIComponent(photo)}`
  }
}
