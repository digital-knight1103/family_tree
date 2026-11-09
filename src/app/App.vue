<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import SaveStatusIndicator from '@/shared/components/SaveStatusIndicator.vue'
import { useUnsavedGuard } from '@/shared/composables/useUnsavedGuard'
import { useFamilyStore } from '@/stores/family'

const store = useFamilyStore()
useUnsavedGuard(store)
onMounted(() => store.load())
</script>

<template>
  <div data-testid="app-shell" class="min-h-screen">
    <header v-if="store.source === 'user'" class="flex justify-end border-b px-4 py-2">
      <SaveStatusIndicator
        :status="store.saveStatus"
        :save-error="store.saveError"
        @retry="store.retrySave()"
      />
    </header>
    <RouterView />
  </div>
</template>
