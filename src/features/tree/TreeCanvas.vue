<script setup lang="ts">
import { computed, markRaw, toRef, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { getRepository } from '@/data'
import type { FamilyData } from '@/domain/schema'
import ElkEdge from './ElkEdge.vue'
import PersonNode from './PersonNode.vue'
import UnionNode from './UnionNode.vue'
import { toFlow } from './to-flow'
import { useTreeLayout } from './useTreeLayout'

const FLOW_ID = 'family-tree'

const props = defineProps<{ data: FamilyData }>()

const nodeTypes = { union: markRaw(UnionNode) }
const edgeTypes = { elk: markRaw(ElkEdge) }

const { layout, error } = useTreeLayout(toRef(props, 'data'))
const flow = computed(() =>
  layout.value
    ? toFlow(layout.value, props.data, (photo) => getRepository().photoUrl(photo))
    : { nodes: [], edges: [] },
)

const { fitView, onNodesInitialized } = useVueFlow(FLOW_ID)
let fitted = false
onNodesInitialized(() => {
  if (fitted) return
  fitted = true
  void fitView({ padding: 0.1 })
})
watch(layout, (value) => {
  if (!value) fitted = false
})
</script>

<template>
  <div data-testid="tree-canvas" class="relative h-full min-h-0 w-full">
    <p v-if="error" role="alert" class="p-6 text-destructive">
      Nie udało się ułożyć drzewa: {{ error }}
    </p>
    <VueFlow
      :id="FLOW_ID"
      :nodes="flow.nodes"
      :edges="flow.edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :min-zoom="0.1"
    >
      <template #node-person="{ data: nodeData }">
        <PersonNode
          v-if="nodeData.view"
          :view="nodeData.view"
          :photo-url="nodeData.photoUrl"
          :selected="false"
        />
      </template>
    </VueFlow>
  </div>
</template>
