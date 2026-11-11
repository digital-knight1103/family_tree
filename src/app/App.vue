<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { ReviewButton } from '@/features/research'
import { SearchBox } from '@/features/search'
import { CenterOnSelfButton } from '@/features/tree'
import AppBackdrop from '@/shared/components/AppBackdrop.vue'
import SaveStatusIndicator from '@/shared/components/SaveStatusIndicator.vue'
import ThemeToggle from '@/shared/components/ThemeToggle.vue'
import { useUnsavedGuard } from '@/shared/composables/useUnsavedGuard'
import { useFamilyStore } from '@/stores/family'
import { useThemeStore } from '@/stores/theme'

useThemeStore()
const store = useFamilyStore()
useUnsavedGuard(store)
onMounted(() => store.load())

const hasPersons = computed(() => (store.data?.persons.length ?? 0) > 0)
</script>

<template>
  <AppBackdrop />
  <div data-testid="app-shell" class="flex h-screen flex-col">
    <header
      class="glass-strong relative z-10 flex shrink-0 items-center justify-between gap-4 border-x-0 border-t-0 px-4 py-2"
    >
      <div class="flex items-center gap-2">
        <span class="mr-2 font-heading text-base font-semibold tracking-tight"
          >Drzewo Rodzinne</span
        >
        <SearchBox v-if="hasPersons" />
        <ReviewButton v-if="hasPersons" />
        <CenterOnSelfButton />
      </div>
      <div class="flex items-center gap-2">
        <SaveStatusIndicator
          v-if="store.source === 'user'"
          :status="store.saveStatus"
          :save-error="store.saveError"
          @retry="store.retrySave()"
        />
        <ThemeToggle />
      </div>
    </header>
    <RouterView />
  </div>
</template>
