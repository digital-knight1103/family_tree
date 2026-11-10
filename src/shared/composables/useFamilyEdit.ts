import { computed, ref } from 'vue'
import type { FamilyData } from '@/domain/schema'
import { useFamilyStore } from '@/stores/family'

export function useFamilyEdit() {
  const store = useFamilyStore()
  const error = ref<string | null>(null)

  function run<T>(
    mutator: (draft: FamilyData) => T,
    opts?: { immediate?: boolean },
  ): T | undefined {
    try {
      let result: T | undefined
      store.update((draft) => {
        result = mutator(draft)
      }, opts)
      error.value = null
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return undefined
    }
  }

  return { canEdit: computed(() => store.canEdit), error, run }
}
