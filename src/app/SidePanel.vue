<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { usePanelStore } from '@/stores/panel'
import { useSelectionStore } from '@/stores/selection'

const panel = usePanelStore()
const selection = useSelectionStore()
</script>

<template>
  <aside
    v-if="panel.view.kind !== 'closed'"
    data-testid="side-panel"
    aria-label="Panel osoby"
    class="w-[360px] shrink-0 overflow-y-auto border-l bg-background p-4"
  >
    <div class="mb-4 flex justify-end">
      <Button variant="ghost" size="sm" @click="selection.select(null)">Zamknij</Button>
    </div>
    <slot v-if="panel.view.kind === 'card'" name="card" :person-id="panel.view.personId" />
    <slot v-else-if="panel.view.kind === 'edit'" name="edit" :person-id="panel.view.personId" />
    <slot
      v-else-if="panel.view.kind === 'add'"
      name="add"
      :anchor-id="panel.view.anchorId"
      :relation="panel.view.relation"
    />
  </aside>
</template>
