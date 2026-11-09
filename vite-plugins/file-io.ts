import { randomBytes } from 'node:crypto'
import fs, { type FileHandle } from 'node:fs/promises'
import path from 'node:path'

export type TempFileHandle = Pick<FileHandle, 'writeFile' | 'sync' | 'close'>

export interface FsLike {
  rename(a: string, b: string): Promise<void>
  open?(file: string, flags: string): Promise<TempFileHandle>
}

const RETRYABLE_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])
const BACKUP_PATTERN = /^family-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}\.json$/

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | null)?.code
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function writeFileAtomic(
  target: string,
  content: string | Uint8Array,
  fsImpl: FsLike = fs,
  delaysMs: number[] = [50, 100, 200, 300, 350],
): Promise<void> {
  const temp = `${target}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  const open = fsImpl.open?.bind(fsImpl) ?? ((file: string, flags: string) => fs.open(file, flags))
  try {
    const handle = await open(temp, 'w')
    try {
      await handle.writeFile(content, 'utf8')
      // Flush to disk before the rename so a crash cannot leave an empty family.json.
      await handle.sync()
    } catch (error) {
      await handle.close().catch(() => undefined)
      throw error
    }
    await handle.close()
    for (let attempt = 0; ; attempt++) {
      try {
        await fsImpl.rename(temp, target)
        return
      } catch (error) {
        const code = errorCode(error)
        if (attempt >= delaysMs.length || code === undefined || !RETRYABLE_CODES.has(code)) {
          throw error
        }
        await delay(delaysMs[attempt] ?? 0)
      }
    }
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => undefined)
    throw error
  }
}

export function backupFileName(now: Date): string {
  const p = (n: number, len = 2) => String(n).padStart(len, '0')
  const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
  const time = `${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`
  return `family-${date}_${time}-${p(now.getMilliseconds(), 3)}.json`
}

export async function backupFile(
  source: string,
  backupsDir: string,
  now: Date,
  keep = 20,
  remove: (file: string) => Promise<void> = (file) => fs.rm(file, { force: true }),
): Promise<string | null> {
  await fs.mkdir(backupsDir, { recursive: true })
  const destination = path.join(backupsDir, backupFileName(now))
  try {
    await fs.copyFile(source, destination)
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return null
    throw error
  }
  const backups = (await fs.readdir(backupsDir)).filter((name) => BACKUP_PATTERN.test(name)).sort()
  for (const name of backups.slice(0, Math.max(0, backups.length - keep))) {
    // Rotation is best-effort: a locked old backup must not fail the save.
    await remove(path.join(backupsDir, name)).catch(() => undefined)
  }
  return destination
}
