<script setup lang="ts">
import { Button } from '@/components/ui/button'

defineEmits<{ start: [] }>()
</script>

<template>
  <div
    data-testid="demo-banner"
    class="flex flex-wrap items-center justify-between gap-2 border-b border-note-border bg-note px-4 py-2 text-sm text-note-foreground"
  >
    <span>To są dane przykładowe. Zmiany nie są zapisywane.</span>
    <Button size="sm" @click="$emit('start')">Rozpocznij własne drzewo</Button>
  </div>
</template>
