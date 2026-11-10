import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { emptyFamilyData, type FamilyData } from '@/domain/schema'
import type { TreeLayout } from '@/domain/tree-layout'
import { useTreeLayout } from './useTreeLayout'

const layoutOf = (width: number): TreeLayout => ({ nodes: [], edges: [], width, height: 0 })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup() {
  const data = ref<FamilyData | null>(emptyFamilyData())
  const calls: Array<ReturnType<typeof deferred<TreeLayout>>> = []
  const layoutFn = () => {
    const call = deferred<TreeLayout>()
    calls.push(call)
    return call.promise
  }
  const scope = effectScope()
  const result = scope.run(() => useTreeLayout(data, layoutFn))!
  return { data, calls, ...result }
}

const flush = () => new Promise((resolve) => setTimeout(resolve))

describe('useTreeLayout', () => {
  it('wygrywa ostatnia zmiana danych', async () => {
    const { data, calls, layout } = setup()
    data.value = emptyFamilyData()
    await nextTick()
    expect(calls).toHaveLength(2)
    calls[1]!.resolve(layoutOf(2))
    await flush()
    calls[0]!.resolve(layoutOf(1))
    await flush()
    expect(layout.value?.width).toBe(2)
  })

  it('poprzedni układ zostaje do czasu nowego', async () => {
    const { data, calls, layout } = setup()
    calls[0]!.resolve(layoutOf(1))
    await flush()
    data.value = emptyFamilyData()
    await nextTick()
    expect(calls).toHaveLength(2)
    expect(layout.value?.width).toBe(1)
    calls[1]!.resolve(layoutOf(2))
    await flush()
    expect(layout.value?.width).toBe(2)
  })

  it('błąd układu trafia do error, a nie wyjątek', async () => {
    const { data, calls, layout, error } = setup()
    calls[0]!.reject(new Error('elk'))
    await flush()
    expect(error.value).toBe('Nie udało się ułożyć drzewa')
    expect(layout.value).toBeNull()

    data.value = emptyFamilyData()
    await nextTick()
    calls[1]!.resolve(layoutOf(2))
    await flush()
    expect(error.value).toBeNull()
    expect(layout.value?.width).toBe(2)
  })

  it('brak danych czyści układ i błąd', async () => {
    const { data, calls, layout, error } = setup()
    calls[0]!.reject(new Error('elk'))
    await flush()
    data.value = null
    await nextTick()
    expect(layout.value).toBeNull()
    expect(error.value).toBeNull()
  })
})
