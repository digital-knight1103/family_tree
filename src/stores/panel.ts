import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { RelativeKind } from '@/domain/family-edits'
import { useSelectionStore } from '@/stores/selection'

export type PanelView =
  | { kind: 'closed' }
  | { kind: 'card'; personId: string }
  | { kind: 'edit'; personId: string }
  | { kind: 'add'; anchorId: string; relation: RelativeKind }

type PanelMode =
  { kind: 'edit'; personId: string } | { kind: 'add'; anchorId: string; relation: RelativeKind }

export const usePanelStore = defineStore('panel', () => {
  const selection = useSelectionStore()
  const mode = ref<PanelMode | null>(null)

  const view = computed<PanelView>(() => {
    const selected = selection.selectedPersonId
    if (!selected) return { kind: 'closed' }
    const current = mode.value
    if (current?.kind === 'edit' && current.personId === selected) return current
    if (current?.kind === 'add' && current.anchorId === selected) return current
    return { kind: 'card', personId: selected }
  })

  watch(() => selection.selectedPersonId, showCard, { flush: 'sync' })

  function openAdd(anchorId: string, kind: RelativeKind) {
    mode.value = { kind: 'add', anchorId, relation: kind }
  }

  function openEdit(personId: string) {
    mode.value = { kind: 'edit', personId }
  }

  function showCard() {
    mode.value = null
  }

  return { view, openAdd, openEdit, showCard }
})
