<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { useFamilyStore } from '@/stores/family'
import { usePhotoStore } from '@/stores/photos'

const props = defineProps<{ personId: string }>()

const family = useFamilyStore()
const photos = usePhotoStore()
const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)

const person = computed(() => family.data?.persons.find((p) => p.id === props.personId))
const url = computed(() => (person.value ? photos.urlFor(person.value) : undefined))

async function guarded(action: () => Promise<void>) {
  busy.value = true
  try {
    await action()
  } finally {
    busy.value = false
  }
}

async function onFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (file) await guarded(() => photos.upload(props.personId, file))
}
</script>

<template>
  <div class="space-y-2" data-testid="photo-field">
    <p class="text-sm font-medium">Zdjęcie</p>
    <div class="flex items-center gap-3">
      <img v-if="url" :src="url" alt="" class="size-16 shrink-0 rounded-full object-cover" />
      <div class="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" :disabled="busy" @click="input?.click()">
          {{ url ? 'Zmień zdjęcie' : 'Dodaj zdjęcie' }}
        </Button>
        <Button
          v-if="url"
          type="button"
          variant="outline"
          size="sm"
          :disabled="busy"
          @click="guarded(() => photos.remove(personId))"
        >
          Usuń zdjęcie
        </Button>
      </div>
    </div>
    <input
      ref="input"
      type="file"
      accept="image/*"
      class="sr-only"
      tabindex="-1"
      @change="onFile"
    />
    <p v-if="photos.errorFor(personId)" role="alert" class="text-sm text-destructive">
      {{ photos.errorFor(personId) }}
    </p>
  </div>
</template>
