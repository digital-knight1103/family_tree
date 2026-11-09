import { ref, watch, type Ref } from 'vue'
import type { FamilyData } from '@/domain/schema'
import { buildTreeGraph, layoutTree, type TreeLayout } from '@/domain/tree-layout'

export function useTreeLayout(data: Ref<FamilyData | null>) {
  const layout = ref<TreeLayout | null>(null)
  const error = ref<string | null>(null)
  let run = 0

  watch(
    data,
    async (value) => {
      const current = ++run
      if (!value) {
        layout.value = null
        return
      }
      try {
        const result = await layoutTree(buildTreeGraph(value))
        if (current !== run) return
        layout.value = result
        error.value = null
      } catch (e) {
        if (current !== run) return
        error.value = e instanceof Error ? e.message : String(e)
      }
    },
    { immediate: true },
  )

  return { layout, error }
}
