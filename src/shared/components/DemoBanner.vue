<script setup lang="ts">
import { Button } from '@/components/ui/button'

defineProps<{ filePath?: string }>()
defineEmits<{ start: [] }>()
</script>

<template>
  <div
    data-testid="demo-banner"
    class="flex flex-wrap items-center justify-between gap-2 border-b border-note-border bg-note px-4 py-2 text-sm text-note-foreground"
  >
    <div class="flex min-w-0 flex-col">
      <span>To są dane przykładowe. Zmiany nie są zapisywane.</span>
      <span v-if="filePath" data-testid="demo-file-path" class="text-xs break-all">
        Szukano danych w: {{ filePath }}
      </span>
    </div>
    <Button size="sm" @click="$emit('start')">Rozpocznij własne drzewo</Button>
  </div>
</template>
