import { resetDataDir } from './fixtures/data-dir'

// Runs once in the main runner process (the config itself is re-evaluated in every worker).
export default function globalSetup(): void {
  resetDataDir('empty')
}
