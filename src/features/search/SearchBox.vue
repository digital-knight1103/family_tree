<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { useFamilyStore } from '@/stores/family'
import { usePanelStore } from '@/stores/panel'
import { searchResults } from './search-results'

const family = useFamilyStore()
const panel = usePanelStore()

const LISTBOX_ID = 'search-results'
const query = ref('')
const open = ref(false)
const activeIndex = ref(0)
const input = useTemplateRef<{ $el: HTMLInputElement }>('input')

const results = computed(() => (family.data ? searchResults(family.data, query.value) : []))
const showList = computed(() => open.value && query.value.trim() !== '')

watch(query, (text) => {
  activeIndex.value = 0
  if (text.trim() !== '') open.value = true
})

function optionId(index: number) {
  return `${LISTBOX_ID}-${index}`
}

function choose(personId: string) {
  panel.openCard(personId)
  query.value = ''
  open.value = false
  input.value?.$el.blur()
}

function move(step: number) {
  const count = results.value.length
  if (count === 0) return
  open.value = true
  activeIndex.value = (activeIndex.value + step + count) % count
  void nextTick(() =>
    document.getElementById(optionId(activeIndex.value))?.scrollIntoView?.({ block: 'nearest' }),
  )
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    move(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'Enter') {
    const result = results.value[activeIndex.value]
    if (showList.value && result) {
      event.preventDefault()
      choose(result.personId)
    }
  } else if (event.key === 'Escape') {
    query.value = ''
    open.value = false
    input.value?.$el.blur()
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  const ctrlK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
  const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey
  if (!ctrlK && !(slash && !isEditable(event.target))) return
  event.preventDefault()
  input.value?.$el.focus()
})
</script>

<template>
  <div class="relative w-72">
    <Input
      ref="input"
      v-model="query"
      type="search"
      role="combobox"
      aria-label="Szukaj osoby"
      aria-autocomplete="list"
      :aria-controls="LISTBOX_ID"
      :aria-expanded="showList && results.length > 0"
      :aria-activedescendant="showList && results.length > 0 ? optionId(activeIndex) : undefined"
      placeholder="Szukaj osoby… (/)"
      autocomplete="off"
      @keydown="onKeydown"
      @focus="open = true"
      @blur="open = false"
    />
    <ul
      v-if="showList && results.length > 0"
      :id="LISTBOX_ID"
      role="listbox"
      aria-label="Wyniki wyszukiwania"
      class="absolute top-full right-0 left-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
    >
      <li
        v-for="(result, index) in results"
        :id="optionId(index)"
        :key="result.personId"
        role="option"
        :aria-selected="index === activeIndex"
        class="flex cursor-pointer items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
        @mousedown.prevent="choose(result.personId)"
        @mousemove="activeIndex = index"
      >
        <span>{{ result.displayName }}</span>
        <span class="shrink-0 text-xs text-muted-foreground">{{ result.lifeSpan }}</span>
      </li>
    </ul>
    <p
      v-else-if="showList"
      role="status"
      data-testid="search-empty"
      class="absolute top-full right-0 left-0 z-50 mt-1 rounded-lg border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md"
    >
      Brak wyników
    </p>
  </div>
</template>
