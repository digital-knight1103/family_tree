// @vitest-environment node
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { createServer, type ViteDevServer } from 'vite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyFamilyData } from '../src/domain/schema'
import { devDataApi } from './dev-data-api'

interface Json {
  kind?: string
  error?: string
  filePath?: string
  data?: { revision: number }
  hash?: string
  revision?: number
  errors: unknown[]
}

const json = (response: Response) => response.json() as Promise<Json>
let tmp: string
let vite: ViteDevServer | undefined
let server: http.Server | undefined
let base: string

async function start(options: Parameters<typeof devDataApi>[0] = { dataDir: tmp }) {
  vite = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [devDataApi(options)],
    server: { middlewareMode: true },
    appType: 'spa',
  })
  server = http.createServer(vite.middlewares)
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'drzewo żółw '))
})

afterEach(async () => {
  const current = server
  if (current) {
    current.closeAllConnections()
    await new Promise((resolve) => current.close(resolve))
  }
  await vite?.close()
  server = undefined
  vite = undefined
  await fs.rm(tmp, { recursive: true, force: true })
})

const getFamily = () => fetch(`${base}/__data/family`).then(json)
const fileHash = async () =>
  createHash('sha256')
    .update(await fs.readFile(path.join(tmp, 'family.json')))
    .digest('hex')
const createFamily = async () => {
  const body = await json(await fetch(`${base}/__data/family/new`, { method: 'POST' }))
  return body.hash
}
const putFamily = (body: unknown) =>
  fetch(`${base}/__data/family`, { method: 'PUT', body: JSON.stringify(body) })
const putPhoto = (id: string, body: Buffer | string, type = 'image/png') =>
  fetch(`${base}/__data/photos/${id}`, { method: 'PUT', body, headers: { 'Content-Type': type } })
const image = () =>
  sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#888' } })
    .png()
    .toBuffer()

describe('GET/PUT/POST /__data/family', () => {
  it('zgłasza brak pliku', async () => {
    await start()
    expect(await getFamily()).toEqual({ kind: 'missing', filePath: path.join(tmp, 'family.json') })
  })

  it('zgłasza brak pliku z bezwzględną ścieżką także dla względnego dataDir', async () => {
    await start({ dataDir: path.relative(process.cwd(), tmp) })
    const { filePath } = await getFamily()
    expect(filePath).toBe(path.join(tmp, 'family.json'))
    expect(path.isAbsolute(filePath ?? '')).toBe(true)
  })

  it('tworzy nowe drzewo, a potem je odczytuje', async () => {
    await start()
    const created = await fetch(`${base}/__data/family/new`, { method: 'POST' })
    expect(created.status).toBe(201)
    const body = await json(created)
    expect(body.data?.revision).toBe(0)
    expect(body.hash).toBe(await fileHash())
    const read = await getFamily()
    expect(read.kind).toBe('ok')
    expect(read.hash).toBe(await fileHash())
    const again = await fetch(`${base}/__data/family/new`, { method: 'POST' })
    expect(again.status).toBe(409)
    expect(await json(again)).toEqual({ error: 'exists' })
  })

  it('zapisuje, a drugi zapis ze starą bazą to konflikt', async () => {
    await start()
    const baseHash = await createFamily()
    const ok = await putFamily({ data: emptyFamilyData(), baseRevision: 0, baseHash })
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(await json(ok)).toEqual({ revision: 1, hash: await fileHash() })
    const conflict = await putFamily({ data: emptyFamilyData(), baseRevision: 0, baseHash })
    expect(conflict.status).toBe(409)
    expect(await json(conflict)).toEqual({ error: 'conflict' })
  })

  it('ręczna zmiana pliku po odczycie z innej karty to konflikt dla starej karty', async () => {
    await start()
    await createFamily()
    const { hash: tabA } = await getFamily()
    const file = path.join(tmp, 'family.json')
    await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('{}', '{ }'))
    await getFamily()
    const res = await putFamily({ data: emptyFamilyData(), baseRevision: 0, baseHash: tabA })
    expect(res.status).toBe(409)
  })

  it('odrzuca zapis z cyklem kodem 422', async () => {
    await start()
    const baseHash = await createFamily()
    const person = (id: string) => ({
      id,
      givenNames: 'A',
      surname: 'B',
      sex: 'male',
      living: true,
    })
    const data = {
      ...emptyFamilyData(),
      persons: [person('p_1'), person('p_2')],
      parentChild: [
        { parentId: 'p_1', childId: 'p_2', type: 'biological' },
        { parentId: 'p_2', childId: 'p_1', type: 'biological' },
      ],
    }
    const res = await putFamily({ data, baseRevision: 0, baseHash })
    expect(res.status).toBe(422)
    expect((await json(res)).errors.length).toBeGreaterThan(0)
  })

  it('zapis do brakującego pliku to 404', async () => {
    await start()
    const res = await putFamily({ data: emptyFamilyData(), baseRevision: 0, baseHash: 'x' })
    expect(res.status).toBe(404)
  })

  it('uszkodzony plik: GET invalid, PUT 423', async () => {
    await start()
    await fs.writeFile(path.join(tmp, 'family.json'), '{ nie json')
    const body = await getFamily()
    expect(body.kind).toBe('invalid')
    expect(body.errors.length).toBeGreaterThan(0)
    const res = await putFamily({ data: emptyFamilyData(), baseRevision: 0, baseHash: 'x' })
    expect(res.status).toBe(423)
    expect((await json(res)).errors.length).toBeGreaterThan(0)
  })

  it('400 dla niepoprawnego JSON-a i brakujących pól', async () => {
    await start()
    await fetch(`${base}/__data/family/new`, { method: 'POST' })
    const bad = await fetch(`${base}/__data/family`, { method: 'PUT', body: '{ nie json' })
    expect(bad.status).toBe(400)
    expect(typeof (await json(bad)).error).toBe('string')
    const data = emptyFamilyData()
    const baseHash = await fileHash()
    expect((await putFamily({ data, baseHash })).status).toBe(400)
    expect((await putFamily({ baseRevision: 0, baseHash })).status).toBe(400)
    expect((await putFamily({ data, baseRevision: 'x', baseHash })).status).toBe(400)
    expect((await putFamily({ data, baseRevision: 0 })).status).toBe(400)
    expect((await putFamily({ data, baseRevision: 0, baseHash: 7 })).status).toBe(400)
    expect(await fs.readFile(path.join(tmp, 'family.json'), 'utf8')).toContain('"revision": 0')
  })

  it('413 dla zbyt dużego ciała (> 10 MB)', async () => {
    await start()
    const res = await fetch(`${base}/__data/family`, {
      method: 'PUT',
      body: Buffer.alloc(10 * 1024 * 1024 + 1, 32),
    })
    expect(res.status).toBe(413)
  })
})

describe('zdjęcia', () => {
  it('zapisuje zdjęcie jako webp i je zwraca', async () => {
    await start()
    const res = await putPhoto('p_1', await image())
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ photo: 'p_1.webp' })
    const meta = await sharp(await fs.readFile(path.join(tmp, 'photos', 'p_1.webp'))).metadata()
    expect([meta.format, meta.width]).toEqual(['webp', 800])
    const get = await fetch(`${base}/__data/photos/p_1.webp`)
    expect(get.status).toBe(200)
    expect(get.headers.get('content-type')).toBe('image/webp')
    expect(get.headers.get('cache-control')).toBe('no-cache')
  })

  it('DELETE usuwa zdjęcie (204), a GET daje 404; ponowny DELETE też 204', async () => {
    await start()
    await putPhoto('p_1', await image())
    const del = await fetch(`${base}/__data/photos/p_1`, { method: 'DELETE' })
    expect(del.status).toBe(204)
    expect((await fetch(`${base}/__data/photos/p_1.webp`)).status).toBe(404)
    expect((await fetch(`${base}/__data/photos/p_1`, { method: 'DELETE' })).status).toBe(204)
  })

  it('blokuje path traversal i niepoprawne identyfikatory', async () => {
    await start()
    await fs.writeFile(path.join(tmp, 'family.json'), '{}')
    expect((await fetch(`${base}/__data/photos/..%2Ffamily.json`)).status).toBe(404)
    expect((await fetch(`${base}/__data/photos/..%5Cfamily.json`)).status).toBe(404)
    expect((await fetch(`${base}/__data/photos/%2e%2e%2ffamily.json`)).status).toBe(404)
    expect((await fetch(`${base}/__data/photos/CON.webp`)).status).toBe(404)
    expect((await putPhoto('zly%20id', await image())).status).toBe(400)
    expect((await putPhoto('..%2Fp_1', await image())).status).toBe(400)
    expect((await fetch(`${base}/__data/photos/..%2Fp_1`, { method: 'DELETE' })).status).toBe(400)
    expect((await fetch(`${base}/__data/photos/%E0%A4%A`, { method: 'DELETE' })).status).toBe(400)
  })

  it('400 dla Content-Type innego niż image/* oraz dla uszkodzonego obrazu', async () => {
    await start()
    expect((await putPhoto('p_1', await image(), 'text/plain')).status).toBe(400)
    expect((await putPhoto('p_1', 'to nie jest obraz')).status).toBe(400)
    await expect(fs.access(path.join(tmp, 'photos', 'p_1.webp'))).rejects.toThrow()
  })

  it('413 dla zdjęcia większego niż 15 MB', async () => {
    await start()
    const res = await putPhoto('p_1', Buffer.alloc(15 * 1024 * 1024 + 1))
    expect(res.status).toBe(413)
  })
})

describe('routing i konfiguracja', () => {
  it('nieznana ścieżka lub metoda pod /__data to JSON 404/405, nie SPA', async () => {
    await start()
    const unknown = await fetch(`${base}/__data/nic`)
    expect(unknown.status).toBe(404)
    expect(unknown.headers.get('content-type')).toContain('application/json')
    const method = await fetch(`${base}/__data/family`, { method: 'DELETE' })
    expect(method.status).toBe(405)
    expect(typeof (await json(method)).error).toBe('string')
    expect((await fetch(`${base}/__data/family/new`)).status).toBe(405)
  })

  it('ścieżki spoza /__data trafiają do next()', async () => {
    await start()
    const res = await fetch(`${base}/__datax`)
    expect(res.headers.get('content-type') ?? '').not.toContain('application/json')
  })

  it('bierze katalog z process.env.FAMILY_DATA_DIR, gdy brak opcji dataDir', async () => {
    const previous = process.env.FAMILY_DATA_DIR
    process.env.FAMILY_DATA_DIR = tmp
    try {
      await start({})
      expect((await getFamily()).filePath).toBe(path.join(tmp, 'family.json'))
    } finally {
      if (previous === undefined) delete process.env.FAMILY_DATA_DIR
      else process.env.FAMILY_DATA_DIR = previous
    }
  })
})
