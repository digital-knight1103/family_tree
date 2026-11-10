<script setup lang="ts">
import { computed } from 'vue'
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

function center() {
  if (selfId.value && centerOnPerson(selfId.value)) selection.select(selfId.value)
}
</script>

<template>
  <Button variant="outline" size="sm" :disabled="!selfId" @click="center">Wyśrodkuj na mnie</Button>
</template>
