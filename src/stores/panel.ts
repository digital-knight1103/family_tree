import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { RelativeKind } from '@/domain/family-edits'
import { useSelectionStore } from '@/stores/selection'

export type PanelView =
  | { kind: 'closed' }
  | { kind: 'review' }
  | { kind: 'card'; personId: string }
  | { kind: 'edit'; personId: string }
  | { kind: 'add'; anchorId: string; relation: RelativeKind }

type PanelMode =
  | { kind: 'review' }
  | { kind: 'edit'; personId: string }
  | { kind: 'add'; anchorId: string; relation: RelativeKind }

export const usePanelStore = defineStore('panel', () => {
  const selection = useSelectionStore()
  const mode = ref<PanelMode | null>(null)
  /** The card was opened from the review list, so it offers a way back. */
  const fromReview = ref(false)

  const view = computed<PanelView>(() => {
    const current = mode.value
    if (current?.kind === 'review') return current
    const selected = selection.selectedPersonId
    if (!selected) return { kind: 'closed' }
    if (current?.kind === 'edit' && current.personId === selected) return current
    if (current?.kind === 'add' && current.anchorId === selected) return current
    return { kind: 'card', personId: selected }
  })

  const canReturnToReview = computed(() => fromReview.value && view.value.kind === 'card')

  watch(
    () => selection.selectedPersonId,
    () => {
      mode.value = null
      fromReview.value = false
    },
    { flush: 'sync' },
  )

  function openAdd(anchorId: string, kind: RelativeKind) {
    mode.value = { kind: 'add', anchorId, relation: kind }
  }

  function openEdit(personId: string) {
    mode.value = { kind: 'edit', personId }
  }

  function showCard() {
    mode.value = null
  }

  /** Selects and centres the person and shows their card, even if they were already selected. */
  function openCard(personId: string, opts?: { fromReview?: boolean }) {
    selection.focus(personId)
    mode.value = null
    fromReview.value = opts?.fromReview ?? false
  }

  /** Clears the selection first, so the tree is not dimmed behind the list and a node click opens its card. */
  function openReview() {
    selection.select(null)
    mode.value = { kind: 'review' }
    fromReview.value = false
  }

  function close() {
    mode.value = null
    fromReview.value = false
    selection.select(null)
  }

  return { view, canReturnToReview, openAdd, openEdit, showCard, openCard, openReview, close }
})
