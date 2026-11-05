// @vitest-environment node
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { toWebp } from './photos'

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#888' } })
    .png()
    .toBuffer()

describe('toWebp', () => {
  it('zmniejsza dłuższy bok do 800 px', async () => {
    const meta = await sharp(await toWebp(await png(2000, 1000))).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 800, 400])
  })

  it('nie powiększa małych obrazów', async () => {
    const meta = await sharp(await toWebp(await png(300, 200))).metadata()
    expect([meta.width, meta.height]).toEqual([300, 200])
  })

  it('obraca według EXIF', async () => {
    const tagged = await sharp(await png(200, 100))
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer()
    const meta = await sharp(await toWebp(tagged)).metadata()
    expect([meta.width, meta.height]).toEqual([100, 200])
  })

  it('odrzuca dane, które nie są obrazem', async () => {
    await expect(toWebp(Buffer.from('to nie jest obraz'))).rejects.toThrow()
  })
})
