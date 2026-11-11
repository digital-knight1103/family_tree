<script setup lang="ts">
import { computed } from 'vue'
import { PERSON_NODE } from '@/domain/tree-layout'
import type { RelativeKind } from '@/domain/family-edits'
import { MapPin } from '@lucide/vue'
import type { NodeHighlight, RelativeGroup } from './highlight'
import { nodeTextWidth } from './node-size'
import type { PersonNodeView } from './person-node-view'

const props = withDefaults(
  defineProps<{
    view: PersonNodeView
    photoUrl?: string
    selected: boolean
    editable?: boolean
    width?: number
    height?: number
    highlight?: NodeHighlight
  }>(),
  {
    photoUrl: undefined,
    editable: false,
    width: PERSON_NODE.width,
    height: PERSON_NODE.height,
    highlight: undefined,
  },
)
defineEmits<{ add: [kind: RelativeKind] }>()

const GROUP_BACKGROUNDS: Record<RelativeGroup, string> = {
  parent: 'bg-violet-50 dark:bg-violet-950/50',
  sibling: 'bg-emerald-50 dark:bg-emerald-950/50',
  partner: 'bg-amber-50 dark:bg-amber-950/50',
  child: 'bg-cyan-50 dark:bg-cyan-950/50',
}

const background = computed(() => {
  const group = props.highlight
  if (group && group !== 'dimmed') return GROUP_BACKGROUNDS[group]
  return props.view.unknown ? 'bg-muted/50' : 'bg-card'
})

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
    :data-highlight="highlight"
    class="relative flex items-center gap-2 rounded-md border border-l-4 px-2 text-card-foreground transition-opacity data-[selected=true]:ring-2 data-[selected=true]:ring-ring data-[sex=female]:border-l-rose-400 data-[sex=male]:border-l-sky-500 data-[sex=unknown]:border-l-muted-foreground"
    :class="[
      background,
      { 'border-dashed': view.unknown },
      highlight === 'dimmed' ? 'opacity-40' : view.unknown ? 'opacity-70' : '',
    ]"
    :style="{ width: `${width}px`, height: `${height}px` }"
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
    <div class="flex min-w-0 flex-col" :style="{ width: `${nodeTextWidth(width)}px` }">
      <span v-if="view.nameLine" class="whitespace-nowrap text-sm font-medium">{{
        view.nameLine
      }}</span>
      <span v-if="view.surnameLine" class="whitespace-nowrap text-sm">{{ view.surnameLine }}</span>
      <span v-if="view.dates" class="whitespace-nowrap text-xs text-muted-foreground">{{
        view.dates
      }}</span>
      <span
        v-if="view.birthPlace"
        data-testid="birth-place"
        class="flex items-start gap-1 text-[11px] leading-[14px] text-muted-foreground"
      >
        <MapPin aria-hidden="true" class="mt-px size-3 shrink-0" />
        <span class="min-w-0 [overflow-wrap:anywhere]">{{ view.birthPlace }}</span>
      </span>
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
