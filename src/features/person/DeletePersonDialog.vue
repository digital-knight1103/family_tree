<script setup lang="ts">
import { computed } from 'vue'
import {
  AlertDialog,
  AlertDialogAction,
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

async function confirm() {
  const id = props.personId
  const result = run((draft) => deletePerson(draft, id), { immediate: true })
  if (result?.photo) await photos.discard(id)
}
</script>

<template>
  <div v-if="person">
    <AlertDialog>
      <AlertDialogTrigger as-child>
        <Button type="button" variant="destructive">Usuń osobę</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Usunąć {{ displayName }}?</AlertDialogTitle>
        <AlertDialogDescription>
          Zostanie usuniętych relacji: {{ relations }}.
        </AlertDialogDescription>
        <div class="flex justify-end gap-2">
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction @click="confirm">Usuń</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
    <p v-if="error" role="alert" class="mt-2 text-sm text-destructive">{{ error }}</p>
  </div>
</template>
