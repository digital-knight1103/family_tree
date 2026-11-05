import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface FsLike {
  rename(a: string, b: string): Promise<void>
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
  content: string,
  fsImpl: FsLike = fs,
  delaysMs: number[] = [50, 100, 200, 300, 350],
): Promise<void> {
  const temp = `${target}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  await fs.writeFile(temp, content, 'utf8')
  try {
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
    await fs.rm(path.join(backupsDir, name), { force: true })
  }
  return destination
}
