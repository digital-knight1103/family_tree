<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { SaveStatus } from '@/data'

defineProps<{ status: SaveStatus; saveError: string | null }>()
defineEmits<{ retry: [] }>()

function reload() {
  location.reload()
}
</script>

<template>
  <div data-testid="save-status" class="text-sm" aria-live="polite">
    <template v-if="status === 'pending' || status === 'saving'">Zapisywanie…</template>
    <template v-else-if="status === 'saved'">Zapisano</template>
    <div v-else-if="status === 'error'" class="flex items-center gap-2">
      <div>
        <p>Błąd zapisu</p>
        <p v-if="saveError" class="text-xs text-muted-foreground">{{ saveError }}</p>
      </div>
      <Button size="sm" variant="outline" @click="$emit('retry')">Ponów</Button>
    </div>
    <div v-else-if="status === 'conflict'" class="flex items-center gap-2">
      <div>
        <p>Dane zmieniły się w innej karcie, odśwież</p>
        <p class="text-xs text-muted-foreground">Ostatnie zmiany nie zostały zapisane.</p>
      </div>
      <Button size="sm" variant="outline" @click="reload">Odśwież</Button>
    </div>
  </div>
</template>
