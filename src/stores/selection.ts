import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useFamilyStore } from '@/stores/family'

export const useSelectionStore = defineStore('selection', () => {
  const family = useFamilyStore()
  const selectedPersonId = ref<string | null>(null)
  const pendingFocusId = ref<string | null>(null)

  function select(id: string | null) {
    selectedPersonId.value = id
  }

  function focus(id: string) {
    selectedPersonId.value = id
    pendingFocusId.value = id
  }

  function focusDone() {
    pendingFocusId.value = null
  }

  watch(
    () => family.data,
    (data) => {
      if (!data) return
      const exists = (id: string | null) => id === null || data.persons.some((p) => p.id === id)
      if (!exists(selectedPersonId.value)) selectedPersonId.value = null
      if (!exists(pendingFocusId.value)) pendingFocusId.value = null
    },
  )

  return { selectedPersonId, pendingFocusId, select, focus, focusDone }
})
