<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { reviewEntries } from '@/domain/review'
import { useFamilyStore } from '@/stores/family'
import { usePanelStore } from '@/stores/panel'

const family = useFamilyStore()
const panel = usePanelStore()

const count = computed(() => (family.data ? reviewEntries(family.data).length : 0))
</script>

<template>
  <Button variant="outline" size="sm" data-testid="review-button" @click="panel.openReview()">
    Do sprawdzenia · {{ count }}
  </Button>
</template>
