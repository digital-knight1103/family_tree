import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSelectionStore = defineStore('selection', () => {
  const selectedPersonId = ref<string | null>(null)

  function select(id: string | null) {
    selectedPersonId.value = id
  }

  return { selectedPersonId, select }
})
