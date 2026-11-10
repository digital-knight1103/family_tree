<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  addPerson,
  addRelative,
  canAddRelative,
  needsCoParentChoice,
  type CoParent,
  type NewPersonInput,
  type RelativeKind,
} from '@/domain/family-edits'
import { unionsOf } from '@/domain/relations'
import type { Sex } from '@/domain/schema'
import { personNodeView } from '@/features/tree'
import { useFamilyEdit } from '@/shared/composables/useFamilyEdit'
import { useFamilyStore } from '@/stores/family'
import { useSelectionStore } from '@/stores/selection'

type Props = { mode: 'relative'; anchorId: string; relation: RelativeKind } | { mode: 'first' }

const props = defineProps<Props>()
const emit = defineEmits<{ done: [personId: string]; cancel: [] }>()

const NO_CO_PARENT = 'none'
const TITLES: Record<RelativeKind, string> = {
  parent: 'Dodaj rodzica',
  partner: 'Dodaj partnera',
  child: 'Dodaj dziecko',
  sibling: 'Dodaj rodzeństwo',
}
const SEX_OPTIONS: Array<{ value: Sex; label: string }> = [
  { value: 'male', label: 'Mężczyzna' },
  { value: 'female', label: 'Kobieta' },
  { value: 'unknown', label: 'Nieznana' },
]

const family = useFamilyStore()
const selection = useSelectionStore()
const { run, error } = useFamilyEdit()

const anchorId = props.mode === 'relative' ? props.anchorId : undefined
const relation = props.mode === 'relative' ? props.relation : undefined

function defaultSex(): Sex {
  if (relation !== 'partner') return 'unknown'
  const anchorSex = family.data?.persons.find((p) => p.id === anchorId)?.sex
  if (anchorSex === 'male') return 'female'
  if (anchorSex === 'female') return 'male'
  return 'unknown'
}

const givenNames = ref('')
const surname = ref('')
const maidenName = ref('')
const sex = ref<Sex>(defaultSex())
const maidenRevealed = ref(false)
const isSelf = ref(true)
const coParentChoice = ref('')

const title = computed(() => (relation ? TITLES[relation] : 'Dodaj pierwszą osobę'))
const showMaiden = computed(() => maidenRevealed.value || sex.value === 'female')

const choiceNeeded = computed(
  () =>
    relation === 'child' &&
    anchorId !== undefined &&
    family.data !== null &&
    needsCoParentChoice(family.data, anchorId),
)

const coParentOptions = computed(() => {
  const data = family.data
  if (!choiceNeeded.value || !data || !anchorId) return []
  return unionsOf(data, anchorId).flatMap((union) => {
    const partner = data.persons.find(
      (p) => p.id === union.partnerIds.find((id) => id !== anchorId),
    )
    return partner ? [{ unionId: union.id, name: personNodeView(partner).displayName }] : []
  })
})

const coParent = computed<CoParent | undefined>(() => {
  if (!choiceNeeded.value || coParentChoice.value === '') return undefined
  return coParentChoice.value === NO_CO_PARENT
    ? { kind: 'none' }
    : { kind: 'union', unionId: coParentChoice.value }
})

const rule = computed(() => {
  if (!family.data || !anchorId || !relation) return { ok: true as const }
  return canAddRelative(family.data, anchorId, relation, undefined, coParent.value)
})

const blockedReason = computed(() => (rule.value.ok ? null : rule.value.reason))
const canSubmit = computed(
  () => rule.value.ok && (!choiceNeeded.value || coParentChoice.value !== ''),
)

function input(): NewPersonInput {
  const person: NewPersonInput = {
    givenNames: givenNames.value.trim(),
    surname: surname.value.trim(),
    sex: sex.value,
  }
  if (showMaiden.value && maidenName.value.trim() !== '') {
    person.maidenName = maidenName.value.trim()
  }
  return person
}

function submit() {
  if (!canSubmit.value) return
  const person = input()
  const newId = run(
    (draft) =>
      anchorId && relation
        ? addRelative(
            draft,
            anchorId,
            relation,
            { kind: 'new', person },
            { coParent: coParent.value },
          )
        : addPerson(draft, person, { self: isSelf.value }),
    { immediate: true },
  )
  if (newId === undefined) return
  selection.focus(newId)
  emit('done', newId)
}
</script>

<template>
  <form data-testid="add-person-form" class="space-y-4" @submit.prevent="submit">
    <h2 class="text-lg font-semibold">{{ title }}</h2>

    <div class="space-y-1.5">
      <Label for="add-given-names">Imiona</Label>
      <Input id="add-given-names" v-model="givenNames" name="givenNames" autocomplete="off" />
    </div>
    <div class="space-y-1.5">
      <Label for="add-surname">Nazwisko</Label>
      <Input id="add-surname" v-model="surname" name="surname" autocomplete="off" />
    </div>

    <fieldset class="space-y-1.5">
      <legend class="text-sm font-medium">Płeć</legend>
      <RadioGroup v-model="sex" orientation="horizontal" class="flex flex-wrap gap-4">
        <div v-for="option in SEX_OPTIONS" :key="option.value" class="flex items-center gap-2">
          <RadioGroupItem :id="`add-sex-${option.value}`" :value="option.value" />
          <Label :for="`add-sex-${option.value}`" class="font-normal">{{ option.label }}</Label>
        </div>
      </RadioGroup>
    </fieldset>

    <div v-if="showMaiden" class="space-y-1.5">
      <Label for="add-maiden-name">Nazwisko rodowe</Label>
      <Input id="add-maiden-name" v-model="maidenName" name="maidenName" autocomplete="off" />
    </div>
    <Button v-else type="button" variant="ghost" size="sm" @click="maidenRevealed = true">
      + nazwisko rodowe
    </Button>

    <fieldset v-if="choiceNeeded" class="space-y-1.5">
      <legend class="text-sm font-medium">Z kim?</legend>
      <RadioGroup v-model="coParentChoice" class="gap-2">
        <div
          v-for="option in coParentOptions"
          :key="option.unionId"
          class="flex items-center gap-2"
        >
          <RadioGroupItem :id="`add-co-${option.unionId}`" :value="option.unionId" />
          <Label :for="`add-co-${option.unionId}`" class="font-normal">{{ option.name }}</Label>
        </div>
        <div class="flex items-center gap-2">
          <RadioGroupItem id="add-co-none" :value="NO_CO_PARENT" />
          <Label for="add-co-none" class="font-normal">nieznany drugi rodzic</Label>
        </div>
      </RadioGroup>
    </fieldset>

    <div v-if="mode === 'first'" class="flex items-center gap-2">
      <input
        id="add-self"
        v-model="isSelf"
        type="checkbox"
        name="self"
        class="size-4 accent-primary"
      />
      <Label for="add-self" class="font-normal">To jestem ja</Label>
    </div>

    <p v-if="blockedReason || error" role="alert" class="text-sm text-destructive">
      {{ blockedReason ?? error }}
    </p>

    <div class="flex gap-2">
      <Button type="submit" :disabled="!canSubmit">Dodaj</Button>
      <Button type="button" variant="outline" @click="emit('cancel')">Anuluj</Button>
    </div>
  </form>
</template>
