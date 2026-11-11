<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import type { GenDate } from '@/domain/dates'
import {
  setSelf,
  updateFact,
  updatePerson,
  type FactKey,
  type PersonPatch,
} from '@/domain/family-edits'
import type { Fact, Person, Sex } from '@/domain/schema'
import { useFamilyEdit } from '@/shared/composables/useFamilyEdit'
import { useFamilyStore } from '@/stores/family'
import DateField from './DateField.vue'
import DeletePersonDialog from './DeletePersonDialog.vue'
import PhotoField from './PhotoField.vue'
import RelationsEditor from './RelationsEditor.vue'

const props = defineProps<{ personId: string }>()
const emit = defineEmits<{ done: [] }>()

type TextKey = 'givenNames' | 'surname' | 'maidenName' | 'bio' | 'researchNotes'

const SEX_OPTIONS: Array<{ value: Sex; label: string }> = [
  { value: 'male', label: 'Mężczyzna' },
  { value: 'female', label: 'Kobieta' },
  { value: 'unknown', label: 'Nieznana' },
]
const FACTS: Array<{ key: FactKey; title: string; dateLabel: string }> = [
  { key: 'birth', title: 'Urodzenie', dateLabel: 'Data urodzenia' },
  { key: 'death', title: 'Śmierć', dateLabel: 'Data śmierci' },
]

const family = useFamilyStore()
const { run, error } = useFamilyEdit()

const person = computed(() => family.data?.persons.find((p) => p.id === props.personId))
const isSelf = computed(() => family.data?.settings.selfPersonId === props.personId)

// Text is controlled locally so a store round trip never rewrites what is being typed.
function textFields(p: Person | undefined) {
  return {
    givenNames: p?.givenNames ?? '',
    surname: p?.surname ?? '',
    maidenName: p?.maidenName ?? '',
    bio: p?.bio ?? '',
    researchNotes: p?.researchNotes ?? '',
    birthPlace: p?.birth?.place ?? '',
    deathPlace: p?.death?.place ?? '',
  }
}
const fields = reactive(textFields(person.value))

watch(
  () => props.personId,
  () => Object.assign(fields, textFields(person.value)),
)

function savePerson(patch: PersonPatch, immediate = false) {
  const id = props.personId
  run((draft) => updatePerson(draft, id, patch), immediate ? { immediate } : undefined)
}

function saveFact(key: FactKey, patch: Partial<Fact>) {
  const id = props.personId
  run((draft) => updateFact(draft, id, key, patch))
}

const TRIMMED: ReadonlySet<TextKey> = new Set(['givenNames', 'surname', 'maidenName'])

function onText(key: TextKey, value: string | number) {
  fields[key] = String(value)
  savePerson({ [key]: TRIMMED.has(key) ? fields[key].trim() : fields[key] })
}

function onPlace(key: FactKey, value: string | number) {
  const field = key === 'birth' ? 'birthPlace' : 'deathPlace'
  fields[field] = String(value)
  saveFact(key, { place: fields[field] })
}

function onDate(key: FactKey, date: GenDate | undefined) {
  if (key !== 'death' || date === undefined) return saveFact(key, { date })
  const id = props.personId
  run((draft) => {
    updateFact(draft, id, key, { date })
    updatePerson(draft, id, { living: false })
  })
}

function onSex(value: unknown) {
  savePerson({ sex: value as Sex }, true)
}

function onLiving(value: boolean | 'indeterminate') {
  savePerson({ living: value === true }, true)
}

function markSelf() {
  const id = props.personId
  run((draft) => setSelf(draft, id), { immediate: true })
}
</script>

<template>
  <form
    v-if="person"
    data-testid="person-edit-form"
    class="space-y-4"
    @submit.prevent="emit('done')"
  >
    <h2 class="text-lg font-semibold">Edycja osoby</h2>

    <PhotoField :person-id="personId" />

    <div class="space-y-1.5">
      <Label for="edit-given-names">Imiona</Label>
      <Input
        id="edit-given-names"
        :model-value="fields.givenNames"
        autocomplete="off"
        @update:model-value="onText('givenNames', $event)"
      />
    </div>
    <div class="space-y-1.5">
      <Label for="edit-surname">Nazwisko</Label>
      <Input
        id="edit-surname"
        :model-value="fields.surname"
        autocomplete="off"
        @update:model-value="onText('surname', $event)"
      />
    </div>
    <div class="space-y-1.5">
      <Label for="edit-maiden-name">Nazwisko rodowe</Label>
      <Input
        id="edit-maiden-name"
        :model-value="fields.maidenName"
        autocomplete="off"
        @update:model-value="onText('maidenName', $event)"
      />
    </div>

    <fieldset class="space-y-1.5">
      <legend class="text-sm font-medium">Płeć</legend>
      <RadioGroup
        :model-value="person.sex"
        orientation="horizontal"
        class="flex flex-wrap gap-4"
        @update:model-value="onSex"
      >
        <div v-for="option in SEX_OPTIONS" :key="option.value" class="flex items-center gap-2">
          <RadioGroupItem :id="`edit-sex-${option.value}`" :value="option.value" />
          <Label :for="`edit-sex-${option.value}`" class="font-normal">{{ option.label }}</Label>
        </div>
      </RadioGroup>
    </fieldset>

    <div class="flex items-center gap-2">
      <Checkbox id="edit-living" :model-value="person.living" @update:model-value="onLiving" />
      <Label for="edit-living" class="font-normal">Żyje</Label>
    </div>

    <fieldset v-for="fact in FACTS" :key="fact.key" class="space-y-3 rounded-md border p-3">
      <legend class="px-1 text-sm font-medium">{{ fact.title }}</legend>
      <DateField
        :id="`edit-${fact.key}-date`"
        :key="`${personId}-${fact.key}`"
        :label="fact.dateLabel"
        :model-value="person[fact.key]?.date"
        @update:model-value="onDate(fact.key, $event)"
      />
      <div class="space-y-1.5">
        <Label :for="`edit-${fact.key}-place`">Miejsce</Label>
        <Input
          :id="`edit-${fact.key}-place`"
          :model-value="fact.key === 'birth' ? fields.birthPlace : fields.deathPlace"
          autocomplete="off"
          @update:model-value="onPlace(fact.key, $event)"
        />
      </div>
      <div class="flex items-center gap-2">
        <Checkbox
          :id="`edit-${fact.key}-unconfirmed`"
          :model-value="person[fact.key]?.unconfirmed === true"
          @update:model-value="saveFact(fact.key, { unconfirmed: $event === true })"
        />
        <Label :for="`edit-${fact.key}-unconfirmed`" class="font-normal">do potwierdzenia</Label>
      </div>
    </fieldset>

    <div class="space-y-1.5">
      <Label for="edit-bio">Biografia</Label>
      <Textarea
        id="edit-bio"
        :model-value="fields.bio"
        @update:model-value="onText('bio', $event)"
      />
      <p class="text-xs text-muted-foreground">Można używać składni Markdown.</p>
    </div>
    <div class="space-y-1.5">
      <Label for="edit-notes">Notatki badawcze</Label>
      <Textarea
        id="edit-notes"
        :model-value="fields.researchNotes"
        @update:model-value="onText('researchNotes', $event)"
      />
    </div>

    <RelationsEditor :person-id="personId" />

    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>

    <div class="flex flex-wrap items-center gap-2">
      <Button type="submit">Gotowe</Button>
      <Button v-if="!isSelf" type="button" variant="outline" @click="markSelf">To jestem ja</Button>
      <span v-else class="text-sm text-muted-foreground">To Ty</span>
      <DeletePersonDialog :person-id="personId" />
    </div>
  </form>
</template>
