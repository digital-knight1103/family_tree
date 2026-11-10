<script setup lang="ts">
import { PERSON_NODE } from '@/domain/tree-layout'
import type { PersonNodeView } from './person-node-view'

defineProps<{ view: PersonNodeView; photoUrl?: string; selected: boolean }>()
</script>

<template>
  <div
    data-testid="person-node"
    :data-person-id="view.personId"
    :data-sex="view.sex"
    :data-unknown="view.unknown ? '' : undefined"
    :data-selected="selected ? 'true' : 'false'"
    class="relative flex items-center gap-2 overflow-hidden rounded-md border border-l-4 bg-card px-2 text-card-foreground data-[selected=true]:ring-2 data-[selected=true]:ring-ring data-[sex=female]:border-l-rose-400 data-[sex=male]:border-l-sky-500 data-[sex=unknown]:border-l-muted-foreground"
    :class="{ 'border-dashed': view.unknown }"
    :style="{ width: `${PERSON_NODE.width}px`, height: `${PERSON_NODE.height}px` }"
  >
    <img
      v-if="photoUrl"
      :src="photoUrl"
      :alt="view.displayName"
      class="size-10 shrink-0 rounded-full object-cover"
    />
    <span
      v-else
      aria-hidden="true"
      class="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
    >
      {{ view.initials }}
    </span>
    <div class="flex min-w-0 flex-col">
      <span class="truncate text-sm font-medium">{{ view.displayName }}</span>
      <span v-if="view.maidenLine" class="truncate text-xs text-muted-foreground">{{
        view.maidenLine
      }}</span>
      <span class="truncate text-xs text-muted-foreground">{{ view.lifeSpan }}</span>
    </div>
    <span
      v-if="view.unconfirmed"
      aria-label="Fakty do potwierdzenia"
      class="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-amber-950"
      >?</span
    >
  </div>
</template>
