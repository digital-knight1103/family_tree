<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { ValidationError } from '@/domain/validate'

defineProps<{ filePath: string; errors: ValidationError[] }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <section data-testid="invalid-data" class="mx-auto max-w-2xl space-y-4 p-6">
    <Alert variant="destructive">
      <AlertTitle>Nie można wczytać danych drzewa</AlertTitle>
      <AlertDescription>
        <p class="break-all">{{ filePath }}</p>
        <ul class="mt-2 list-disc pl-5">
          <li v-for="(error, index) in errors" :key="index">
            {{ error.path || 'cały plik' }} — {{ error.message }}
          </li>
        </ul>
      </AlertDescription>
    </Alert>
    <p class="text-sm">
      Poprzednie wersje znajdziesz w folderze .backups obok pliku oraz w historii repozytorium
      danych.
    </p>
    <Button @click="$emit('retry')">Spróbuj ponownie</Button>
  </section>
</template>
