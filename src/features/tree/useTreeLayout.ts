import { ref, watch, type Ref } from 'vue'
import type { FamilyData } from '@/domain/schema'
import { buildTreeGraph, layoutTree, type TreeLayout } from '@/domain/tree-layout'

export type LayoutFn = (data: FamilyData) => Promise<TreeLayout>

const defaultLayout: LayoutFn = (data) => layoutTree(buildTreeGraph(data))

/** The newest request wins; the previous layout stays visible while a new one is computed. */
export function useTreeLayout(data: Ref<FamilyData | null>, layoutFn: LayoutFn = defaultLayout) {
  const layout = ref<TreeLayout | null>(null)
  const error = ref<string | null>(null)
  let latest = 0

  watch(
    data,
    async (value) => {
      const request = ++latest
      if (!value) {
        layout.value = null
        error.value = null
        return
      }
      try {
        const result = await layoutFn(value)
        if (request !== latest) return
        layout.value = result
        error.value = null
      } catch (e) {
        if (request !== latest) return
        console.error(e)
        error.value = 'Nie udało się ułożyć drzewa'
      }
    },
    { immediate: true },
  )

  return { layout, error }
}
