<script setup lang="ts">
import { computed } from 'vue'
import { useFamilyStore } from '@/stores/family'
import { usePanelStore } from '@/stores/panel'
import { reviewView } from './review-view'

const family = useFamilyStore()
const panel = usePanelStore()

const items = computed(() => (family.data ? reviewView(family.data) : []))
</script>

<template>
  <section data-testid="review-list" aria-labelledby="review-list-title">
    <h2 id="review-list-title" class="mb-3 text-lg font-semibold">Do sprawdzenia</h2>
    <p v-if="items.length === 0" class="text-sm text-muted-foreground">Nic do sprawdzenia.</p>
    <ul v-else class="flex flex-col gap-2">
      <li v-for="item in items" :key="item.personId">
        <button
          type="button"
          data-testid="review-item"
          class="w-full rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          @click="panel.openCard(item.personId, { fromReview: true })"
        >
          <span class="flex items-baseline justify-between gap-3">
            <span class="font-medium">{{ item.displayName }}</span>
            <span class="shrink-0 text-xs text-muted-foreground">{{ item.lifeSpan }}</span>
          </span>
          <span
            v-for="(reason, index) in item.reasons"
            :key="index"
            class="block text-sm text-note-foreground"
          >
            {{ reason }}
          </span>
          <span v-if="item.note" class="mt-1 block text-sm text-muted-foreground">
            {{ item.note }}
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
