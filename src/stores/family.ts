import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw } from 'vue'
import { createSaveQueue, getRepository, type LoadResult, type SaveQueue } from '@/data'
import type { FamilyData } from '@/domain/schema'
import { validateFamilyData, type ValidationError } from '@/domain/validate'

type StoreStatus = 'loading' | 'ready' | 'invalid' | 'load-error'

const CONFLICT_MESSAGE = 'Dane zmieniły się w innej karcie, odśwież'
const READ_ONLY_MESSAGE = 'Edycja niedostępna w wersji tylko do odczytu'
const NOT_READY_MESSAGE = 'Dane nie są gotowe do edycji'
const NO_SAVE_MESSAGE = 'Zapis danych jest niedostępny'

export const useFamilyStore = defineStore('family', () => {
  const status = ref<StoreStatus>('loading')
  const data = shallowRef<FamilyData | null>(null)
  const source = ref<'user' | 'demo' | null>(null)
  const readOnly = ref(false)
  const invalid = ref<{ filePath: string; errors: ValidationError[] } | null>(null)
  const loadError = ref<string | null>(null)
  const queue = shallowRef<SaveQueue | null>(null)

  const saveStatus = computed(() => queue.value?.status.value ?? 'idle')
  const saveError = computed(() => queue.value?.lastError.value ?? null)

  function apply(result: LoadResult) {
    loadError.value = null
    if (result.kind === 'invalid') {
      status.value = 'invalid'
      invalid.value = { filePath: result.filePath, errors: result.errors }
      data.value = null
      source.value = null
      readOnly.value = false
      queue.value = null
      return
    }
    invalid.value = null
    data.value = result.data
    source.value = result.source
    readOnly.value = result.readOnly
    queue.value =
      result.source === 'user' && !result.readOnly
        ? createSaveQueue(getRepository().save.bind(getRepository()), result.data.revision)
        : null
    status.value = 'ready'
  }

  async function run(request: () => Promise<LoadResult>) {
    status.value = 'loading'
    try {
      apply(await request())
    } catch (error) {
      status.value = 'load-error'
      loadError.value = error instanceof Error ? error.message : String(error)
    }
  }

  function load() {
    return run(() => getRepository().load())
  }

  function startOwnTree() {
    return run(() => getRepository().createNew())
  }

  function update(mutator: (draft: FamilyData) => void, opts?: { immediate?: boolean }) {
    if (saveStatus.value === 'conflict') throw new Error(CONFLICT_MESSAGE)
    if (readOnly.value) throw new Error(READ_ONLY_MESSAGE)
    if (status.value !== 'ready' || !data.value) throw new Error(NOT_READY_MESSAGE)
    if (!queue.value) throw new Error(NO_SAVE_MESSAGE)

    const draft = structuredClone(toRaw(data.value))
    mutator(draft)
    const result = validateFamilyData(draft)
    if (!result.ok) {
      const [first] = result.errors
      throw new Error(first?.path ? `${first.path}: ${first.message}` : (first?.message ?? ''))
    }
    data.value = result.data
    queue.value.schedule(result.data, opts)
  }

  function retrySave() {
    queue.value?.retry()
  }

  function flushOnUnload() {
    queue.value?.flushOnUnload()
  }

  function hasUnsaved() {
    return queue.value?.hasUnsaved() ?? false
  }

  return {
    status,
    data,
    source,
    readOnly,
    invalid,
    loadError,
    saveStatus,
    saveError,
    load,
    startOwnTree,
    update,
    retrySave,
    flushOnUnload,
    hasUnsaved,
  }
})
