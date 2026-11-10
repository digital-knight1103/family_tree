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
  const errorPersonId = ref<string | null>(null)
  // The file name is always <personId>.webp, so a replaced photo needs a new query to bypass the browser cache.
  const versions = reactive<Record<string, number>>({})

  function errorFor(personId: string): string | null {
    return errorPersonId.value === personId ? error.value : null
  }

  function fail(personId: string, e: unknown) {
    errorPersonId.value = personId
    error.value = messageOf(e)
  }

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
      fail(personId, e)
    }
  }

  async function discard(personId: string): Promise<boolean> {
    error.value = null
    try {
      await getRepository().deletePhoto(personId)
      return true
    } catch (e) {
      fail(personId, e)
      return false
    }
  }

  async function remove(personId: string): Promise<void> {
    error.value = null
    try {
      family.update((draft) => updatePerson(draft, personId, { photo: undefined }), {
        immediate: true,
      })
    } catch (e) {
      fail(personId, e)
      return
    }
    await discard(personId)
  }

  return { error, errorFor, urlFor, upload, remove, discard }
})
