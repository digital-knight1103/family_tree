<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { useFamilyStore } from '@/stores/family'
import { usePanelStore } from '@/stores/panel'
import { reviewView } from './review-view'

const family = useFamilyStore()
const panel = usePanelStore()

const count = computed(() => (family.data ? reviewView(family.data).length : 0))
</script>

<template>
  <Button
    variant="outline"
    size="sm"
    data-testid="review-button"
    :aria-pressed="panel.view.kind === 'review'"
    @click="panel.openReview()"
  >
    Do sprawdzenia · {{ count }}
  </Button>
</template>
