<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GenDate } from '@/domain/dates'
import {
  removeParentChild,
  removeUnion,
  setParentChildType,
  updateUnion,
} from '@/domain/family-edits'
import { childrenOf, parentsOf, unionsOf } from '@/domain/relations'
import type { ParentChild, Person, Union } from '@/domain/schema'
import { personNodeView } from '@/features/tree'
import { useFamilyEdit } from '@/shared/composables/useFamilyEdit'
import { useFamilyStore } from '@/stores/family'
import DateField from './DateField.vue'

const props = defineProps<{ personId: string }>()

const RELATION_TYPES: Array<{ value: ParentChild['type']; label: string }> = [
  { value: 'biological', label: 'biologiczny' },
  { value: 'adoptive', label: 'adopcyjny' },
]
const UNION_TYPES: Array<{ value: Union['type']; label: string }> = [
  { value: 'marriage', label: 'małżeństwo' },
  { value: 'partnership', label: 'związek' },
]
const SELECT_CLASS =
  'h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const family = useFamilyStore()
const { run, error } = useFamilyEdit()

function nameOf(person: Person): string {
  return personNodeView(person).displayName
}

function edgeType(parentId: string, childId: string): ParentChild['type'] {
  return (
    family.data?.parentChild.find((r) => r.parentId === parentId && r.childId === childId)?.type ??
    'biological'
  )
}

const parents = computed(() =>
  family.data
    ? parentsOf(family.data, props.personId).map((p) => ({
        person: p,
        type: edgeType(p.id, props.personId),
      }))
    : [],
)
const children = computed(() =>
  family.data
    ? childrenOf(family.data, props.personId).map((c) => ({
        person: c,
        type: edgeType(props.personId, c.id),
      }))
    : [],
)
const unions = computed(() => {
  const data = family.data
  if (!data) return []
  return unionsOf(data, props.personId).flatMap((union) => {
    const partnerId = union.partnerIds.find((id) => id !== props.personId)
    const partner = data.persons.find((p) => p.id === partnerId)
    return partner ? [{ union, partner }] : []
  })
})

// Place text is controlled locally so a store round trip never rewrites what is being typed.
const places = reactive<Record<string, string>>({})

function placeOf(union: Union): string {
  return places[union.id] ?? union.start?.place ?? ''
}

function changeType(parentId: string, childId: string, event: Event) {
  const type = (event.target as HTMLSelectElement).value as ParentChild['type']
  run((draft) => setParentChildType(draft, parentId, childId, type), { immediate: true })
}

function removeRelation(parentId: string, childId: string) {
  run((draft) => removeParentChild(draft, parentId, childId), { immediate: true })
}

function changeUnionType(unionId: string, event: Event) {
  const type = (event.target as HTMLSelectElement).value as Union['type']
  run((draft) => updateUnion(draft, unionId, { type }), { immediate: true })
}

function onStartDate(unionId: string, date: GenDate | undefined) {
  run((draft) => updateUnion(draft, unionId, { start: { date } }))
}

function onStartPlace(unionId: string, value: string | number) {
  const place = String(value)
  places[unionId] = place
  run((draft) => updateUnion(draft, unionId, { start: { place } }))
}

function onStartUnconfirmed(unionId: string, value: boolean | 'indeterminate') {
  run((draft) => updateUnion(draft, unionId, { start: { unconfirmed: value === true } }), {
    immediate: true,
  })
}

function onEndDate(unionId: string, date: GenDate | undefined) {
  run((draft) => updateUnion(draft, unionId, { end: { date } }))
}

function removeUnionRow(unionId: string) {
  run((draft) => removeUnion(draft, unionId), { immediate: true })
}
</script>

<template>
  <section data-testid="relations-editor" class="space-y-4">
    <h3 class="text-base font-semibold">Relacje</h3>

    <div v-if="parents.length > 0" class="space-y-2">
      <h4 class="text-sm font-medium">Rodzice</h4>
      <div
        v-for="{ person, type } in parents"
        :key="person.id"
        data-testid="parent-row"
        class="flex flex-wrap items-center gap-2"
      >
        <span class="min-w-0 flex-1 text-sm">{{ nameOf(person) }}</span>
        <select
          :class="SELECT_CLASS"
          :aria-label="`Typ relacji: ${nameOf(person)}`"
          :value="type"
          @change="changeType(person.id, personId, $event)"
        >
          <option v-for="o in RELATION_TYPES" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          @click="removeRelation(person.id, personId)"
        >
          Usuń relację
        </Button>
      </div>
    </div>

    <div v-if="children.length > 0" class="space-y-2">
      <h4 class="text-sm font-medium">Dzieci</h4>
      <div
        v-for="{ person, type } in children"
        :key="person.id"
        data-testid="child-row"
        class="flex flex-wrap items-center gap-2"
      >
        <span class="min-w-0 flex-1 text-sm">{{ nameOf(person) }}</span>
        <select
          :class="SELECT_CLASS"
          :aria-label="`Typ relacji: ${nameOf(person)}`"
          :value="type"
          @change="changeType(personId, person.id, $event)"
        >
          <option v-for="o in RELATION_TYPES" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          @click="removeRelation(personId, person.id)"
        >
          Usuń relację
        </Button>
      </div>
    </div>

    <div v-if="unions.length > 0" class="space-y-2">
      <h4 class="text-sm font-medium">Związki</h4>
      <fieldset
        v-for="{ union, partner } in unions"
        :key="union.id"
        data-testid="union-row"
        class="space-y-3 rounded-md border p-3"
      >
        <legend class="px-1 text-sm font-medium">{{ nameOf(partner) }}</legend>
        <select
          :class="SELECT_CLASS"
          :aria-label="`Typ związku: ${nameOf(partner)}`"
          :value="union.type"
          @change="changeUnionType(union.id, $event)"
        >
          <option v-for="o in UNION_TYPES" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <DateField
          :id="`${union.id}-start-date`"
          :label="`Początek związku (${nameOf(partner)})`"
          :model-value="union.start?.date"
          @update:model-value="onStartDate(union.id, $event)"
        />
        <div class="space-y-1.5">
          <Label :for="`${union.id}-start-place`">Miejsce</Label>
          <Input
            :id="`${union.id}-start-place`"
            :model-value="placeOf(union)"
            autocomplete="off"
            @update:model-value="onStartPlace(union.id, $event)"
          />
        </div>
        <div class="flex items-center gap-2">
          <Checkbox
            :id="`${union.id}-start-unconfirmed`"
            :model-value="union.start?.unconfirmed === true"
            @update:model-value="onStartUnconfirmed(union.id, $event)"
          />
          <Label :for="`${union.id}-start-unconfirmed`" class="font-normal">do potwierdzenia</Label>
        </div>
        <DateField
          :id="`${union.id}-end-date`"
          :label="`Koniec związku (${nameOf(partner)})`"
          :model-value="union.end?.date"
          @update:model-value="onEndDate(union.id, $event)"
        />
        <Button type="button" variant="outline" size="sm" @click="removeUnionRow(union.id)">
          Usuń związek
        </Button>
      </fieldset>
    </div>

    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
  </section>
</template>
