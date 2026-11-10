<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { getRepository } from '@/data'
import { AddPersonForm } from '@/features/editor'
import { PersonCard, personCardView } from '@/features/person'
import { useFamilyStore } from '@/stores/family'
import { usePanelStore } from '@/stores/panel'
import { useSelectionStore } from '@/stores/selection'

const family = useFamilyStore()
const panel = usePanelStore()
const selection = useSelectionStore()

const card = computed(() => {
  const view = panel.view
  if (view.kind !== 'card' || !family.data) return null
  return personCardView(family.data, view.personId)
})

const photoUrl = computed(() =>
  card.value?.photo ? getRepository().photoUrl(card.value.photo) : '',
)
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
    <PersonCard
      v-if="card"
      :view="card"
      :photo-url="photoUrl"
      :can-edit="family.canEdit"
      @select="selection.focus"
      @edit="panel.openEdit(card.personId)"
    />
    <AddPersonForm
      v-else-if="panel.view.kind === 'add'"
      :key="panel.view.anchorId + panel.view.relation"
      mode="relative"
      :anchor-id="panel.view.anchorId"
      :relation="panel.view.relation"
      @cancel="panel.showCard()"
    />
  </aside>
</template>
