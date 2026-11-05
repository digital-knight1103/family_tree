import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { writeFileAtomic } from './file-io.ts'

const MAX_SIDE = 800
const QUALITY = 82

// Resizes (never enlarges), applies the EXIF orientation and drops all metadata.
export async function toWebp(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer()
}

const photosDir = (dataDir: string) => path.join(dataDir, 'photos')

export async function savePhoto(dataDir: string, personId: string, webp: Buffer): Promise<string> {
  await fs.mkdir(photosDir(dataDir), { recursive: true })
  const file = `${personId}.webp`
  await writeFileAtomic(path.join(photosDir(dataDir), file), webp)
  return file
}

export async function deletePhoto(dataDir: string, personId: string): Promise<void> {
  await fs.rm(path.join(photosDir(dataDir), `${personId}.webp`), { force: true })
}

// Returns undefined when the photo does not exist.
export async function readPhoto(dataDir: string, file: string): Promise<Buffer | undefined> {
  try {
    return await fs.readFile(path.join(photosDir(dataDir), file))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}
