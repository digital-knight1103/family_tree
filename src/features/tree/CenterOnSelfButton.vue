<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { useFamilyStore } from '@/stores/family'
import { useSelectionStore } from '@/stores/selection'

const store = useFamilyStore()
const selection = useSelectionStore()

const selfId = computed(() => {
  const id = store.data?.settings.selfPersonId
  return id && store.data?.persons.some((person) => person.id === id) ? id : null
})

function center() {
  if (selfId.value) selection.focus(selfId.value)
}
</script>

<template>
  <Button variant="outline" size="sm" :disabled="!selfId" @click="center">Wyśrodkuj na mnie</Button>
</template>
