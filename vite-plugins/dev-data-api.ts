import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Plugin } from 'vite'
import { resolveDataDir } from '../scripts/resolve-data-dir.ts'
import { PERSON_ID_PATTERN, PHOTO_FILE_PATTERN, type FamilyData } from '../src/domain/schema.ts'
import { createDataStore } from './data-store.ts'
import { deletePhoto, readPhoto, savePhoto, toWebp } from './photos.ts'

const PREFIX = '/__data'
const MAX_FAMILY_BYTES = 10 * 1024 * 1024
const MAX_PHOTO_BYTES = 15 * 1024 * 1024

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

// Collects the body up to `limit` bytes. Past the limit nothing more is buffered;
// the rest of the upload is discarded so the client still receives the 413.
function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let failed = false
    const tooLarge = () => {
      failed = true
      chunks.length = 0
      req.resume()
      reject(new HttpError(413, 'Plik jest za duży'))
    }
    if (Number(req.headers['content-length']) > limit) return tooLarge()
    req.on('data', (chunk: Buffer) => {
      if (failed) return
      size += chunk.length
      if (size > limit) return tooLarge()
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!failed) resolve(Buffer.concat(chunks))
    })
    req.on('error', (error) => {
      if (!failed) reject(error)
    })
  })
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const raw = await readBody(req, MAX_FAMILY_BYTES)
  try {
    return JSON.parse(raw.toString('utf8'))
  } catch {
    throw new HttpError(400, 'Niepoprawny JSON')
  }
}

function decodeSegment(segment: string): string | undefined {
  let decoded: string
  try {
    decoded = decodeURIComponent(segment)
  } catch {
    return undefined
  }
  return /[/\\]|\.\./.test(decoded) ? undefined : decoded
}

export function devDataApi(options: { dataDir?: string } = {}): Plugin {
  return {
    name: 'family-tree-dev-data-api',
    apply: 'serve',
    configureServer(server) {
      const { root, mode } = server.config
      const env = { ...loadEnv(mode, root, ''), ...process.env }
      const dataDir = options.dataDir ?? resolveDataDir(env, root)
      const store = createDataStore(dataDir)

      async function family(req: IncomingMessage, res: ServerResponse, rest: string[]) {
        if (rest.length === 1 && rest[0] === 'new') {
          if (req.method !== 'POST') throw new HttpError(405, 'Metoda niedozwolona')
          const created = await store.createNew()
          if (created.kind === 'exists') return sendJson(res, 409, { error: 'exists' })
          return sendJson(res, 201, { data: created.data, hash: created.hash })
        }
        if (rest.length !== 0) throw new HttpError(404, 'Nie znaleziono')
        if (req.method === 'GET') return sendJson(res, 200, await store.read())
        if (req.method !== 'PUT') throw new HttpError(405, 'Metoda niedozwolona')

        const body = await readJsonBody(req)
        const { data, baseRevision, baseHash } = (body ?? {}) as Record<string, unknown>
        if (
          typeof data !== 'object' ||
          data === null ||
          Array.isArray(data) ||
          !Number.isInteger(baseRevision) ||
          typeof baseHash !== 'string'
        ) {
          throw new HttpError(400, 'Brakuje pola data, baseRevision lub baseHash')
        }
        const result = await store.write(data as FamilyData, {
          revision: baseRevision as number,
          hash: baseHash,
        })
        switch (result.kind) {
          case 'ok':
            return sendJson(res, 200, { revision: result.revision, hash: result.hash })
          case 'conflict':
            return sendJson(res, 409, { error: 'conflict' })
          case 'invalid':
            return sendJson(res, 422, { errors: result.errors })
          case 'blocked':
            return sendJson(res, 423, { errors: result.errors })
          case 'missing':
            return sendJson(res, 404, { error: 'missing' })
        }
      }

      async function photos(req: IncomingMessage, res: ServerResponse, rest: string[]) {
        if (rest.length !== 1) throw new HttpError(404, 'Nie znaleziono')
        const name = decodeSegment(rest[0] ?? '')

        if (req.method === 'GET') {
          if (name === undefined || !PHOTO_FILE_PATTERN.test(name)) {
            throw new HttpError(404, 'Nie znaleziono')
          }
          const bytes = await readPhoto(dataDir, name)
          if (!bytes) throw new HttpError(404, 'Nie znaleziono')
          res.statusCode = 200
          res.setHeader('Content-Type', 'image/webp')
          res.setHeader('Cache-Control', 'no-cache')
          return res.end(bytes)
        }
        if (req.method !== 'PUT' && req.method !== 'DELETE') {
          throw new HttpError(405, 'Metoda niedozwolona')
        }
        if (name === undefined || !PERSON_ID_PATTERN.test(name)) {
          throw new HttpError(400, 'Niepoprawny identyfikator osoby')
        }
        if (req.method === 'DELETE') {
          await deletePhoto(dataDir, name)
          res.statusCode = 204
          return res.end()
        }
        if (!req.headers['content-type']?.toLowerCase().startsWith('image/')) {
          req.resume()
          throw new HttpError(400, 'Oczekiwano obrazu')
        }
        const input = await readBody(req, MAX_PHOTO_BYTES)
        let webp: Buffer
        try {
          webp = await toWebp(input)
        } catch {
          throw new HttpError(400, 'Nie udało się odczytać obrazu')
        }
        return sendJson(res, 200, { photo: await savePhoto(dataDir, name, webp) })
      }

      async function handle(req: IncomingMessage, res: ServerResponse, pathname: string) {
        try {
          const [section, ...rest] = pathname.slice(PREFIX.length).split('/').slice(1)
          if (section === 'family') await family(req, res, rest)
          else if (section === 'photos') await photos(req, res, rest)
          else throw new HttpError(404, 'Nie znaleziono')
        } catch (error) {
          if (error instanceof HttpError) {
            if (!res.headersSent) sendJson(res, error.status, { error: error.message })
            return
          }
          server.config.logger.error(`[dev-data-api] ${String(error)}`)
          if (!res.headersSent) sendJson(res, 500, { error: 'Błąd serwera' })
          else res.end()
        }
      }

      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? ''
        if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) return next()
        void handle(req, res, pathname)
      })
    },
  }
}
