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
  parent: 'bg-tint-parent',
  sibling: 'bg-tint-sibling',
  partner: 'bg-tint-partner',
  child: 'bg-tint-child',
}

const background = computed(() => {
  const group = props.highlight
  if (group && group !== 'dimmed') return GROUP_BACKGROUNDS[group]
  return props.view.unknown ? 'bg-muted/60' : 'bg-glass'
})

interface AddButton {
  kind: RelativeKind
  label: string
  text: string
}

/**
 * Buttons sit above and below the node, never at its sides, so they never cover a partner.
 * Siblings share the parents (above); a partner shares the children (below).
 */
const ADD_ROWS: Array<{ id: string; position: string; buttons: AddButton[] }> = [
  {
    id: 'add-above',
    position: 'bottom-full mb-1',
    buttons: [
      { kind: 'sibling', label: 'Dodaj rodzeństwo', text: 'rodzeństwo' },
      { kind: 'parent', label: 'Dodaj rodzica', text: 'rodzic' },
    ],
  },
  {
    id: 'add-below',
    position: 'top-full mt-1',
    buttons: [
      { kind: 'child', label: 'Dodaj dziecko', text: 'dziecko' },
      { kind: 'partner', label: 'Dodaj partnera', text: 'partner' },
    ],
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
    class="relative flex items-center gap-2 rounded-md border border-l-4 border-glass-border px-2 text-card-foreground shadow-(--glass-shadow) backdrop-blur-md transition-opacity data-[selected=true]:ring-2 data-[selected=true]:ring-ring data-[sex=female]:border-l-sex-female data-[sex=male]:border-l-sex-male data-[sex=unknown]:border-l-muted-foreground"
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
      class="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-badge text-[10px] font-bold text-badge-foreground"
      >?</span
    >
    <template v-if="selected && editable">
      <div
        v-for="row in ADD_ROWS"
        :key="row.id"
        :data-testid="row.id"
        class="absolute left-1/2 flex -translate-x-1/2 gap-1"
        :class="row.position"
      >
        <button
          v-for="button in row.buttons"
          :key="button.kind"
          type="button"
          :aria-label="button.label"
          class="nodrag nopan flex h-6 items-center whitespace-nowrap rounded-full border bg-popover px-2 text-xs text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
          @click.stop="$emit('add', button.kind)"
        >
          + {{ button.text }}
        </button>
      </div>
    </template>
  </div>
</template>
