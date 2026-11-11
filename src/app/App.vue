<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { SearchBox } from '@/features/search'
import { CenterOnSelfButton } from '@/features/tree'
import SaveStatusIndicator from '@/shared/components/SaveStatusIndicator.vue'
import { useUnsavedGuard } from '@/shared/composables/useUnsavedGuard'
import { useFamilyStore } from '@/stores/family'

const store = useFamilyStore()
useUnsavedGuard(store)
onMounted(() => store.load())

const hasPersons = computed(() => (store.data?.persons.length ?? 0) > 0)
</script>

<template>
  <div data-testid="app-shell" class="flex h-screen flex-col">
    <header class="flex shrink-0 items-center justify-between gap-4 border-b px-4 py-2">
      <div class="flex items-center gap-2">
        <SearchBox v-if="hasPersons" />
        <CenterOnSelfButton />
      </div>
      <SaveStatusIndicator
        v-if="store.source === 'user'"
        :status="store.saveStatus"
        :save-error="store.saveError"
        @retry="store.retrySave()"
      />
    </header>
    <RouterView />
  </div>
</template>
