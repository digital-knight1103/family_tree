<script setup lang="ts">
import { computed, ref } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatGenDate, formatGenDateInput, parseGenDate, type GenDate } from '@/domain/dates'

const props = defineProps<{ modelValue?: GenDate; label: string; id: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: GenDate | undefined] }>()

const text = ref(props.modelValue ? formatGenDateInput(props.modelValue) : '')

const parsed = computed(() => (text.value.trim() === '' ? null : parseGenDate(text.value)))
const preview = computed(() => (parsed.value?.ok ? formatGenDate(parsed.value.value) : ''))
const error = computed(() => (parsed.value && !parsed.value.ok ? parsed.value.error : ''))

function onInput(value: string | number) {
  text.value = String(value)
  if (parsed.value === null) emit('update:modelValue', undefined)
  else if (parsed.value.ok) emit('update:modelValue', parsed.value.value)
}
</script>

<template>
  <div class="space-y-1.5">
    <Label :for="id">{{ label }}</Label>
    <Input
      :id="id"
      :model-value="text"
      :aria-invalid="error !== ''"
      :aria-describedby="`${id}-hint`"
      autocomplete="off"
      placeholder="np. 12.03.1921 albo ok. 1890"
      @update:model-value="onInput"
    />
    <p
      :id="`${id}-hint`"
      :role="error ? 'alert' : undefined"
      :data-testid="error ? 'date-error' : 'date-preview'"
      class="min-h-4 text-xs"
      :class="error ? 'text-destructive' : 'text-muted-foreground'"
    >
      {{ error || preview }}
    </p>
  </div>
</template>
