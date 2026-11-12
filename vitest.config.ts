import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      // Raw CSS imports (the contrast test reads the theme tokens); other CSS stays stubbed.
      css: { include: [/\.css\?raw$/] },
      include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts', 'vite-plugins/**/*.spec.ts'],
    },
  }),
)
