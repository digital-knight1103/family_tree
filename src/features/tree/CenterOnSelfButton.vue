<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { Button } from '@/components/ui/button'
import { useFamilyStore } from '@/stores/family'
import { useSelectionStore } from '@/stores/selection'
import { useTreeNavigation } from './useTreeNavigation'

const store = useFamilyStore()
const selection = useSelectionStore()
const { centerOnPerson } = useTreeNavigation()

const selfId = computed(() => {
  const id = store.data?.settings.selfPersonId
  return id && store.data?.persons.some((person) => person.id === id) ? id : null
})

// Selecting opens the side panel, which narrows the canvas; wait for Vue Flow to measure it before centering.
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

async function center() {
  const id = selfId.value
  if (!id) return
  selection.select(id)
  await nextTick()
  await nextFrame()
  await nextFrame()
  centerOnPerson(id)
}
</script>

<template>
  <Button variant="outline" size="sm" :disabled="!selfId" @click="center">Wyśrodkuj na mnie</Button>
</template>
