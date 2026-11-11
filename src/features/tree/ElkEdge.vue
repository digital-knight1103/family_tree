<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, type EdgeProps } from '@vue-flow/core'
import type { ElkEdgeData } from './to-flow'

const props = defineProps<EdgeProps<ElkEdgeData>>()

const path = computed(() =>
  (props.data?.points ?? []).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '),
)
</script>

<template>
  <BaseEdge :id="id" :path="path" :style="data?.dimmed ? { opacity: 0.25 } : undefined" />
</template>
