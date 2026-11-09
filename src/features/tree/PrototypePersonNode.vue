<script setup lang="ts">
import { computed } from 'vue'
import type { NodeProps } from '@vue-flow/core'
import { formatLifeSpan } from '@/domain/dates'
import { PERSON_NODE } from '@/domain/tree-layout'
import { useFamilyStore } from '@/stores/family'

const props = defineProps<NodeProps<{ personId: string }>>()
const store = useFamilyStore()

const person = computed(() => store.data?.persons.find((p) => p.id === props.data.personId))
const lifeSpan = computed(() =>
  person.value
    ? formatLifeSpan(person.value.birth?.date, person.value.death?.date, !person.value.living)
    : '',
)
</script>

<template>
  <div
    v-if="person"
    data-testid="person-node"
    :data-person-id="person.id"
    class="flex flex-col justify-center rounded-md border bg-card px-3 text-card-foreground"
    :style="{ width: `${PERSON_NODE.width}px`, height: `${PERSON_NODE.height}px` }"
  >
    <span class="truncate text-sm font-medium">{{ person.givenNames }} {{ person.surname }}</span>
    <span class="text-xs text-muted-foreground">{{ lifeSpan }}</span>
  </div>
</template>
