<script setup lang="ts">
import SidePanel from '@/app/SidePanel.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AddPersonForm } from '@/features/editor'
import { TreeCanvas } from '@/features/tree'
import DemoBanner from '@/shared/components/DemoBanner.vue'
import EmptyTreeState from '@/shared/components/EmptyTreeState.vue'
import InvalidDataScreen from '@/shared/components/InvalidDataScreen.vue'
import { useFamilyStore } from '@/stores/family'
import { usePanelStore } from '@/stores/panel'

const store = useFamilyStore()
const panel = usePanelStore()
</script>

<template>
  <div
    v-if="store.status === 'loading'"
    data-testid="loading"
    role="status"
    class="flex items-center justify-center gap-3 p-10"
  >
    <span
      class="size-5 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
    <span>Wczytywanie danych…</span>
  </div>
  <InvalidDataScreen
    v-else-if="store.status === 'invalid' && store.invalid"
    :file-path="store.invalid.filePath"
    :errors="store.invalid.errors"
    @retry="store.load()"
  />
  <section v-else-if="store.status === 'load-error'" data-testid="load-error" class="p-6">
    <Alert variant="destructive" class="max-w-2xl">
      <AlertTitle>Nie udało się wczytać danych</AlertTitle>
      <AlertDescription>{{ store.loadError }}</AlertDescription>
    </Alert>
    <Button class="mt-4" @click="store.load()">Spróbuj ponownie</Button>
  </section>
  <template v-else-if="store.status === 'ready' && store.data">
    <DemoBanner v-if="store.source === 'demo'" @start="store.startOwnTree()" />
    <EmptyTreeState v-if="store.data.persons.length === 0">
      <AddPersonForm v-if="store.canEdit" mode="first" />
    </EmptyTreeState>
    <div v-else class="flex min-h-0 flex-1">
      <div class="min-w-0 flex-1">
        <TreeCanvas :data="store.data" :editable="store.canEdit" @add="panel.openAdd" />
      </div>
      <SidePanel />
    </div>
  </template>
</template>
