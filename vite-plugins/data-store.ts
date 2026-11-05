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
  | { kind: 'ok'; filePath: string; data: FamilyData; hash: string }

// What the client last saw: the revision and the sha256 of the raw file bytes.
export interface WriteBase {
  revision: number
  hash: string
}

export type WriteResult =
  | { kind: 'ok'; revision: number; hash: string }
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

export function createDataStore(dataDir: string, deps: { now?: () => Date; fsImpl?: FsLike } = {}) {
  const now = deps.now ?? (() => new Date())
  const filePath = path.join(dataDir, 'family.json')
  const backupsDir = path.join(dataDir, '.backups')
  let queue: Promise<unknown> = Promise.resolve()

  // Runs mutations one at a time so read, check, backup and write never interleave.
  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task)
    queue = run.catch(() => undefined)
    return run
  }

  async function read(): Promise<ReadResult> {
    let bytes: Buffer
    try {
      bytes = await fs.readFile(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'missing', filePath }
      throw error
    }
    const parsed = parseFamilyJson(bytes.toString('utf8'))
    if (!parsed.ok) return { kind: 'invalid', filePath, errors: parsed.errors }
    return { kind: 'ok', filePath, data: parsed.data, hash: sha256(bytes) }
  }

  // The hash check catches manual edits that keep the revision; the client holds
  // the base, so a read from another tab or a server restart cannot approve them.
  async function writeUnlocked(next: FamilyData, base: WriteBase): Promise<WriteResult> {
    const current = await read()
    if (current.kind === 'missing') return { kind: 'missing' }
    if (current.kind === 'invalid') return { kind: 'blocked', errors: current.errors }
    if (base.revision !== current.data.revision || base.hash !== current.hash) {
      return { kind: 'conflict' }
    }
    const revision = current.data.revision + 1
    const validated = validateFamilyData({ ...next, revision })
    if (!validated.ok) return { kind: 'invalid', errors: validated.errors }
    await backupFile(filePath, backupsDir, now())
    const content = serialize(validated.data)
    await writeFileAtomic(filePath, content, deps.fsImpl)
    return { kind: 'ok', revision, hash: sha256(content) }
  }

  async function createNewUnlocked(): Promise<
    { kind: 'ok'; data: FamilyData; hash: string } | { kind: 'exists' }
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
    return { kind: 'ok', data, hash: sha256(content) }
  }

  return {
    read,
    write: (next: FamilyData, base: WriteBase) => serialized(() => writeUnlocked(next, base)),
    createNew: () => serialized(createNewUnlocked),
  }
}
