import path from 'node:path'

const DEFAULT_DATA_DIR = path.join('data', 'family')

export function resolveDataDir(env: { FAMILY_DATA_DIR?: string }, projectRoot: string): string {
  const configured = env.FAMILY_DATA_DIR?.trim()
  return path.resolve(projectRoot, configured || DEFAULT_DATA_DIR)
}
