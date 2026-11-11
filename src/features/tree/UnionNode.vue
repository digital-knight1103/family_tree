<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core'
import type { UnionNodeData } from './to-flow'

defineProps<NodeProps<UnionNodeData>>()
</script>

<template>
  <div
    class="size-2 rounded-full bg-edge transition-opacity"
    :class="{ 'opacity-30': data?.dimmed }"
  />
</template>
