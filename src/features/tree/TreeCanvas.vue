<script setup lang="ts">
import { computed, markRaw, toRef, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { getRepository } from '@/data'
import type { FamilyData } from '@/domain/schema'
import { useSelectionStore } from '@/stores/selection'
import ElkEdge from './ElkEdge.vue'
import PersonNode from './PersonNode.vue'
import UnionNode from './UnionNode.vue'
import { FLOW_ID } from './flow-id'
import { toFlow } from './to-flow'
import { useTreeLayout } from './useTreeLayout'
import { useTreeNavigation } from './useTreeNavigation'

const props = defineProps<{ data: FamilyData }>()

const nodeTypes = { union: markRaw(UnionNode) }
const edgeTypes = { elk: markRaw(ElkEdge) }

const { layout, error } = useTreeLayout(toRef(props, 'data'))
const flow = computed(() =>
  layout.value
    ? toFlow(layout.value, props.data, (photo) => getRepository().photoUrl(photo))
    : { nodes: [], edges: [] },
)

const selection = useSelectionStore()
const { centerOnPerson, fitAll } = useTreeNavigation()
const { onNodesInitialized, onNodeClick, onPaneClick } = useVueFlow(FLOW_ID)

let positioned = false
onNodesInitialized(() => {
  if (positioned) return
  positioned = true
  const selfId = props.data.settings.selfPersonId
  if (!selfId || !centerOnPerson(selfId)) fitAll()
})

onNodeClick(({ node }) => {
  if (node.type === 'person') selection.select(node.data.view.personId)
})
onPaneClick(() => selection.select(null))

watch(
  () => props.data,
  (data) => {
    const id = selection.selectedPersonId
    if (id && !data.persons.some((person) => person.id === id)) selection.select(null)
  },
)
</script>

<template>
  <div data-testid="tree-canvas" class="relative h-full min-h-0 w-full">
    <p v-if="error" role="alert" class="p-6 text-destructive">{{ error }}</p>
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
          :selected="nodeData.view.personId === selection.selectedPersonId"
        />
      </template>
      <MiniMap position="bottom-right" pannable zoomable />
      <Controls position="bottom-left" />
    </VueFlow>
  </div>
</template>
