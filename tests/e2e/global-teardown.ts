import fs from 'node:fs'
import os from 'node:os'

// TEMP points at test-results/.tmp during e2e runs; empty it so browser/node junk never accumulates.
export default function globalTeardown(): void {
  const dir = os.tmpdir()
  for (const entry of fs.readdirSync(dir)) {
    try {
      fs.rmSync(`${dir}/${entry}`, { recursive: true, force: true })
    } catch {
      // best effort
    }
  }
}
