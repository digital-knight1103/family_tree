import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  emptyFamilyData,
  factSchema,
  endFactSchema,
  familyDataSchema,
  genDateSchema,
  parentChildSchema,
  personSchema,
  unionSchema,
  type FamilyData,
} from '../src/domain/schema.ts'
import {
  parseFamilyJson,
  validateFamilyData,
  type ValidationError,
} from '../src/domain/validate.ts'
import { backupFile, writeFileAtomic, type FsLike } from './file-io.ts'

export type ReadResult =
  | { kind: 'missing'; filePath: string }
  | { kind: 'invalid'; filePath: string; errors: ValidationError[] }
  | { kind: 'ok'; filePath: string; data: FamilyData }

export type WriteResult =
  | { kind: 'ok'; revision: number }
  | { kind: 'conflict' }
  | { kind: 'invalid'; errors: ValidationError[] }
  | { kind: 'blocked'; errors: ValidationError[] }
  | { kind: 'missing' }

type Dict = Record<string, unknown>

// Copies the keys of `value` in the order of a schema shape; absent keys stay absent.
function inOrder(shape: object, value: Dict, nested: Dict = {}): Dict {
  const result: Dict = {}
  for (const key of Object.keys(shape)) {
    const item = value[key]
    if (item === undefined) continue
    const convert = nested[key] as ((x: unknown) => unknown) | undefined
    result[key] = convert ? convert(item) : item
  }
  return result
}

const each = (convert: (x: Dict) => unknown) => (items: unknown) => (items as Dict[]).map(convert)

const orderDate = (x: Dict) => inOrder(genDateSchema.shape, x)
const orderFact = (x: Dict) => inOrder(factSchema.shape, x, { date: orderDate })
const orderEndFact = (x: Dict) => inOrder(endFactSchema.shape, x, { date: orderDate })
const orderPerson = (x: Dict) =>
  inOrder(personSchema.shape, x, { birth: orderFact, death: orderFact })
const orderParentChild = (x: Dict) => inOrder(parentChildSchema.shape, x)
const orderUnion = (x: Dict) =>
  inOrder(unionSchema.shape, x, { start: orderFact, end: orderEndFact })

function serialize(data: FamilyData): string {
  const ordered = inOrder(familyDataSchema.shape, data, {
    settings: (x: Dict) => inOrder(familyDataSchema.shape.settings.shape, x),
    persons: each(orderPerson),
    parentChild: each(orderParentChild),
    unions: each(orderUnion),
  })
  return JSON.stringify(ordered, null, 2) + '\n'
}

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')

type LoadResult = ReadResult & { hash?: string }

export function createDataStore(dataDir: string, deps: { now?: () => Date; fsImpl?: FsLike } = {}) {
  const now = deps.now ?? (() => new Date())
  const filePath = path.join(dataDir, 'family.json')
  const backupsDir = path.join(dataDir, '.backups')
  let knownHash: string | undefined
  let queue: Promise<unknown> = Promise.resolve()

  // Runs mutations one at a time so read, check, backup and write never interleave.
  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task)
    queue = run.catch(() => undefined)
    return run
  }

  async function load(): Promise<LoadResult> {
    let bytes: Buffer
    try {
      bytes = await fs.readFile(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'missing', filePath }
      throw error
    }
    const parsed = parseFamilyJson(bytes.toString('utf8'))
    const hash = sha256(bytes)
    if (!parsed.ok) return { kind: 'invalid', filePath, errors: parsed.errors, hash }
    return { kind: 'ok', filePath, data: parsed.data, hash }
  }

  async function read(): Promise<ReadResult> {
    const { hash, ...result } = await load()
    if (result.kind === 'ok') knownHash = hash
    return result
  }

  async function writeUnlocked(next: FamilyData, baseRevision: number): Promise<WriteResult> {
    const current = await load()
    if (current.kind === 'missing') return { kind: 'missing' }
    if (current.kind === 'invalid') return { kind: 'blocked', errors: current.errors }
    if (
      (knownHash !== undefined && current.hash !== knownHash) ||
      baseRevision !== current.data.revision
    ) {
      return { kind: 'conflict' }
    }
    const revision = current.data.revision + 1
    const validated = validateFamilyData({ ...next, revision })
    if (!validated.ok) return { kind: 'invalid', errors: validated.errors }
    await backupFile(filePath, backupsDir, now())
    const content = serialize(validated.data)
    await writeFileAtomic(filePath, content, deps.fsImpl)
    knownHash = sha256(content)
    return { kind: 'ok', revision }
  }

  async function createNewUnlocked(): Promise<
    { kind: 'ok'; data: FamilyData } | { kind: 'exists' }
  > {
    await fs.mkdir(dataDir, { recursive: true })
    const data = emptyFamilyData()
    const content = serialize(data)
    try {
      await fs.writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return { kind: 'exists' }
      throw error
    }
    knownHash = sha256(content)
    return { kind: 'ok', data }
  }

  return {
    read,
    write: (next: FamilyData, baseRevision: number) =>
      serialized(() => writeUnlocked(next, baseRevision)),
    createNew: () => serialized(createNewUnlocked),
  }
}
