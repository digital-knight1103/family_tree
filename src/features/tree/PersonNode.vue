<script setup lang="ts">
import { PERSON_NODE } from '@/domain/tree-layout'
import type { RelativeKind } from '@/domain/family-edits'
import type { PersonNodeView } from './person-node-view'

defineProps<{ view: PersonNodeView; photoUrl?: string; selected: boolean; editable?: boolean }>()
defineEmits<{ add: [kind: RelativeKind] }>()

const ADD_BUTTONS: Array<{ kind: RelativeKind; label: string; text: string; position: string }> = [
  {
    kind: 'parent',
    label: 'Dodaj rodzica',
    text: 'rodzic',
    position: 'bottom-full left-1/2 mb-1 -translate-x-1/2',
  },
  {
    kind: 'partner',
    label: 'Dodaj partnera',
    text: 'partner',
    position: 'left-full top-1/2 ml-1 -translate-y-1/2',
  },
  {
    kind: 'child',
    label: 'Dodaj dziecko',
    text: 'dziecko',
    position: 'top-full left-1/2 mt-1 -translate-x-1/2',
  },
  {
    kind: 'sibling',
    label: 'Dodaj rodzeństwo',
    text: 'rodzeństwo',
    position: 'right-full top-1/2 mr-1 -translate-y-1/2',
  },
]
</script>

<template>
  <div
    data-testid="person-node"
    :data-person-id="view.personId"
    :data-sex="view.sex"
    :data-unknown="view.unknown ? '' : undefined"
    :data-selected="selected ? 'true' : 'false'"
    class="relative flex items-center gap-2 rounded-md border border-l-4 bg-card px-2 text-card-foreground data-[selected=true]:ring-2 data-[selected=true]:ring-ring data-[sex=female]:border-l-rose-400 data-[sex=male]:border-l-sky-500 data-[sex=unknown]:border-l-muted-foreground"
    :class="{ 'border-dashed bg-muted/50 opacity-70': view.unknown }"
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
    <template v-if="selected && editable">
      <button
        v-for="button in ADD_BUTTONS"
        :key="button.kind"
        type="button"
        :aria-label="button.label"
        class="nodrag nopan absolute flex h-6 items-center whitespace-nowrap rounded-full border bg-background px-2 text-xs text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
        :class="button.position"
        @click.stop="$emit('add', button.kind)"
      >
        + {{ button.text }}
      </button>
    </template>
  </div>
</template>
