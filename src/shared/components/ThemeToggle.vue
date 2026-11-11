<script setup lang="ts">
import { Moon, Sun } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    aria-label="Przełącz motyw"
    :title="theme.theme === 'dark' ? 'Motyw ciemny' : 'Motyw jasny'"
    :data-theme="theme.theme"
    @click="theme.toggle()"
  >
    <Moon v-if="theme.theme === 'dark'" aria-hidden="true" />
    <Sun v-else aria-hidden="true" />
  </Button>
</template>
