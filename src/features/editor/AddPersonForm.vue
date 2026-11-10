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
  type RelativeTarget,
} from '@/domain/family-edits'
import { matchesQuery } from '@/domain/person-search'
import { unionsOf } from '@/domain/relations'
import type { Sex } from '@/domain/schema'
import { personNodeView } from '@/features/tree'
import { useFamilyEdit } from '@/shared/composables/useFamilyEdit'
import { useFamilyStore } from '@/stores/family'
import { useSelectionStore } from '@/stores/selection'

const props = defineProps<{
  mode: 'relative' | 'first'
  anchorId?: string
  relation?: RelativeKind
}>()
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

const MAX_RESULTS = 8

const anchorId = computed(() => (props.mode === 'relative' ? props.anchorId : undefined))
const relation = computed(() => (props.mode === 'relative' ? props.relation : undefined))

function defaultSex(): Sex {
  if (relation.value !== 'partner') return 'unknown'
  const anchorSex = family.data?.persons.find((p) => p.id === anchorId.value)?.sex
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
const linkExisting = ref(false)
const query = ref('')
const selectedId = ref<string | null>(null)

const title = computed(() => (relation.value ? TITLES[relation.value] : 'Dodaj pierwszą osobę'))
const showMaiden = computed(() => maidenRevealed.value || sex.value === 'female')

const choiceNeeded = computed(
  () =>
    relation.value === 'child' &&
    anchorId.value !== undefined &&
    family.data !== null &&
    needsCoParentChoice(family.data, anchorId.value),
)

const coParentOptions = computed(() => {
  const data = family.data
  const anchor = anchorId.value
  if (!choiceNeeded.value || !data || !anchor) return []
  return unionsOf(data, anchor).flatMap((union) => {
    const partner = data.persons.find((p) => p.id === union.partnerIds.find((id) => id !== anchor))
    return partner ? [{ unionId: union.id, name: personNodeView(partner).displayName }] : []
  })
})

const coParent = computed<CoParent | undefined>(() => {
  if (!choiceNeeded.value || coParentChoice.value === '') return undefined
  return coParentChoice.value === NO_CO_PARENT
    ? { kind: 'none' }
    : { kind: 'union', unionId: coParentChoice.value }
})

function ruleFor(target?: RelativeTarget) {
  if (!family.data || !anchorId.value || !relation.value) return { ok: true as const }
  return canAddRelative(family.data, anchorId.value, relation.value, target, coParent.value)
}

const target = computed<RelativeTarget | undefined>(() =>
  linkExisting.value && selectedId.value !== null
    ? { kind: 'existing', personId: selectedId.value }
    : undefined,
)

const rule = computed(() => ruleFor(target.value))

const candidates = computed(() => {
  const data = family.data
  if (!linkExisting.value || !data || query.value.trim() === '') return []
  return data.persons
    .filter((p) => p.id !== anchorId.value && matchesQuery(p, query.value))
    .slice(0, MAX_RESULTS)
    .map((person) => {
      const view = personNodeView(person)
      const result = ruleFor({ kind: 'existing', personId: person.id })
      return {
        id: person.id,
        name: view.displayName,
        lifeSpan: view.lifeSpan,
        reason: result.ok ? null : result.reason,
      }
    })
})

const blockedReason = computed(() => (rule.value.ok ? null : rule.value.reason))
const canSubmit = computed(
  () =>
    rule.value.ok &&
    (!choiceNeeded.value || coParentChoice.value !== '') &&
    (!linkExisting.value || selectedId.value !== null),
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
  const anchor = anchorId.value
  const kind = relation.value
  const chosen = target.value ?? { kind: 'new' as const, person }
  const newId = run(
    (draft) =>
      anchor && kind
        ? addRelative(draft, anchor, kind, chosen, { coParent: coParent.value })
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

    <div v-if="mode === 'relative'" class="flex gap-2">
      <Button
        type="button"
        size="sm"
        :variant="linkExisting ? 'outline' : 'default'"
        :aria-pressed="!linkExisting"
        @click="linkExisting = false"
      >
        Nowa osoba
      </Button>
      <Button
        type="button"
        size="sm"
        :variant="linkExisting ? 'default' : 'outline'"
        :aria-pressed="linkExisting"
        @click="linkExisting = true"
      >
        Istniejąca osoba
      </Button>
    </div>

    <div v-if="linkExisting" class="space-y-1.5">
      <Label for="add-search">Szukaj osoby</Label>
      <Input id="add-search" v-model="query" name="search" autocomplete="off" />
      <ul class="space-y-1">
        <li v-for="candidate in candidates" :key="candidate.id">
          <button
            type="button"
            data-testid="existing-person-item"
            :disabled="candidate.reason !== null"
            :aria-pressed="selectedId === candidate.id"
            class="w-full rounded-md border px-3 py-2 text-left text-sm disabled:opacity-60 aria-pressed:border-primary aria-pressed:bg-accent"
            @click="selectedId = candidate.id"
          >
            <span class="font-medium">{{ candidate.name }}</span>
            <span v-if="candidate.lifeSpan" class="ml-2 text-muted-foreground">
              {{ candidate.lifeSpan }}
            </span>
            <span v-if="candidate.reason" class="block text-destructive">
              {{ candidate.reason }}
            </span>
          </button>
        </li>
      </ul>
    </div>

    <template v-else>
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
    </template>

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
