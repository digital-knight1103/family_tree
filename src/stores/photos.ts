import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { getRepository } from '@/data'
import { updatePerson } from '@/domain/family-edits'
import type { Person } from '@/domain/schema'
import { useFamilyStore } from '@/stores/family'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const usePhotoStore = defineStore('photos', () => {
  const family = useFamilyStore()
  const error = ref<string | null>(null)
  // The file name is always <personId>.webp, so a replaced photo needs a new query to bypass the browser cache.
  const versions = reactive<Record<string, number>>({})

  function urlFor(person: Person): string | undefined {
    if (!person.photo) return undefined
    const url = getRepository().photoUrl(person.photo)
    if (!url) return undefined
    const version = versions[person.id]
    return version === undefined ? url : `${url}?v=${version}`
  }

  async function upload(personId: string, file: File): Promise<void> {
    error.value = null
    try {
      const photo = await getRepository().uploadPhoto(personId, file)
      // The file is already replaced on disk, so the cached image is stale even if the update below fails.
      versions[personId] = (versions[personId] ?? 0) + 1
      family.update((draft) => updatePerson(draft, personId, { photo }), { immediate: true })
    } catch (e) {
      error.value = messageOf(e)
    }
  }

  async function discard(personId: string): Promise<void> {
    try {
      await getRepository().deletePhoto(personId)
    } catch (e) {
      error.value = messageOf(e)
    }
  }

  async function remove(personId: string): Promise<void> {
    error.value = null
    try {
      family.update((draft) => updatePerson(draft, personId, { photo: undefined }), {
        immediate: true,
      })
    } catch (e) {
      error.value = messageOf(e)
      return
    }
    await discard(personId)
  }

  return { error, urlFor, upload, remove, discard }
})
