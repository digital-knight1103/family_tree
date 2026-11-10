<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { deletePerson, relationCount } from '@/domain/family-edits'
import { personNodeView } from '@/features/tree'
import { useFamilyEdit } from '@/shared/composables/useFamilyEdit'
import { useFamilyStore } from '@/stores/family'
import { usePhotoStore } from '@/stores/photos'

const props = defineProps<{ personId: string }>()

const family = useFamilyStore()
const photos = usePhotoStore()
const { run, error } = useFamilyEdit()

const person = computed(() => family.data?.persons.find((p) => p.id === props.personId))
const displayName = computed(() => (person.value ? personNodeView(person.value).displayName : ''))
const relations = computed(() => (family.data ? relationCount(family.data, props.personId) : 0))

const open = ref(false)

// Data first: a failed delete must never leave a person pointing at a removed photo file.
async function confirm() {
  const id = props.personId
  const hadPhoto = person.value?.photo !== undefined
  if (run((draft) => deletePerson(draft, id), { immediate: true }) === undefined) return
  open.value = false
  if (hadPhoto && !(await photos.discard(id))) {
    console.error(`Nie udało się usunąć pliku zdjęcia osoby ${id}.`, photos.errorFor(id))
  }
}
</script>

<template>
  <div v-if="person">
    <AlertDialog v-model:open="open">
      <AlertDialogTrigger as-child>
        <Button type="button" variant="destructive">Usuń osobę</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Usunąć {{ displayName }}?</AlertDialogTitle>
        <AlertDialogDescription>
          Zostanie usuniętych relacji: {{ relations }}.
        </AlertDialogDescription>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <div class="flex justify-end gap-2">
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <Button type="button" @click="confirm">Usuń</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
