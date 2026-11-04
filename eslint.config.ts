import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import js from '@eslint/js'

const srcFiles = ['src/**/*.{ts,vue}']
const specFiles = ['src/**/*.spec.ts']

const relativeParentPattern = {
  group: ['../*', '../../*'],
  message: 'Użyj aliasu @/',
}
const featureInternalsPattern = {
  group: ['@/features/*/*'],
  message: 'Importuj feature przez jego index.ts',
}
const testsPattern = {
  group: ['@tests/*'],
  message: 'Dane testowe importuj tylko w testach',
}

const config: ReturnType<typeof defineConfigWithVueTs> = defineConfigWithVueTs(
  { ignores: ['dist/**', 'coverage/**', 'src/components/ui/**'] },
  js.configs.recommended,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: srcFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [relativeParentPattern, featureInternalsPattern, testsPattern] },
      ],
    },
  },
  {
    // Wewnątrz feature'a dozwolone importy względne do własnych wnętrz.
    files: ['src/features/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [featureInternalsPattern, testsPattern] }],
    },
  },
  {
    files: specFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [relativeParentPattern, featureInternalsPattern] },
      ],
    },
  },
  {
    files: ['src/features/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [featureInternalsPattern] }],
    },
  },
  skipFormatting,
)

export default config
