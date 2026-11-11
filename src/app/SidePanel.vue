<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { AddPersonForm } from '@/features/editor'
import { PersonCard, PersonEditForm, personCardView } from '@/features/person'
import { useFamilyStore } from '@/stores/family'
import { usePanelStore } from '@/stores/panel'
import { usePhotoStore } from '@/stores/photos'
import { useSelectionStore } from '@/stores/selection'

const family = useFamilyStore()
const panel = usePanelStore()
const photos = usePhotoStore()
const selection = useSelectionStore()

const card = computed(() => {
  const view = panel.view
  if (!family.data) return null
  if (view.kind === 'card' || (view.kind === 'edit' && !family.canEdit)) {
    return personCardView(family.data, view.personId)
  }
  return null
})

const photoUrl = computed(() => {
  const person = family.data?.persons.find((p) => p.id === card.value?.personId)
  return person ? photos.urlFor(person) : undefined
})
</script>

<template>
  <aside
    v-if="panel.view.kind !== 'closed'"
    data-testid="side-panel"
    aria-label="Panel osoby"
    class="w-[360px] shrink-0 overflow-y-auto border-l bg-background p-4"
  >
    <div class="mb-4 flex justify-end">
      <Button variant="ghost" size="sm" @click="panel.close()">Zamknij</Button>
    </div>
    <PersonCard
      v-if="card"
      :view="card"
      :photo-url="photoUrl"
      :can-edit="family.canEdit"
      @select="selection.focus"
      @edit="panel.openEdit(card.personId)"
    />
    <PersonEditForm
      v-else-if="panel.view.kind === 'edit'"
      :key="panel.view.personId"
      :person-id="panel.view.personId"
      @done="panel.showCard()"
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
