<script setup lang="ts">
import { Button } from '@/components/ui/button'

defineProps<{ disabled?: boolean }>()
defineEmits<{ start: [] }>()
</script>

<template>
  <div
    data-testid="demo-banner"
    class="flex flex-wrap items-center justify-between gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-950"
  >
    <span>To są dane przykładowe. Zmiany nie są zapisywane.</span>
    <Button size="sm" :disabled="disabled" @click="$emit('start')">Rozpocznij własne drzewo</Button>
  </div>
</template>
