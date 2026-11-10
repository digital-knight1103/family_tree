<script setup lang="ts">
import { computed, markRaw, ref, toRef, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { usePhotoStore } from '@/stores/photos'
import type { RelativeKind } from '@/domain/family-edits'
import type { FamilyData } from '@/domain/schema'
import { useSelectionStore } from '@/stores/selection'
import ElkEdge from './ElkEdge.vue'
import PersonNode from './PersonNode.vue'
import UnionNode from './UnionNode.vue'
import { FLOW_ID } from './flow-id'
import { toFlow } from './to-flow'
import { useTreeLayout } from './useTreeLayout'
import { useTreeNavigation } from './useTreeNavigation'

const props = defineProps<{ data: FamilyData; editable?: boolean }>()
defineEmits<{ add: [anchorId: string, kind: RelativeKind] }>()

const nodeTypes = { union: markRaw(UnionNode) }
const edgeTypes = { elk: markRaw(ElkEdge) }

const { layout, error } = useTreeLayout(toRef(props, 'data'))
const flow = computed(() =>
  layout.value ? toFlow(layout.value, props.data, photos.urlFor) : { nodes: [], edges: [] },
)

const photos = usePhotoStore()
const selection = useSelectionStore()
const { centerOnPerson, fitAll } = useTreeNavigation()
const { nodes, dimensions, onNodesInitialized, onNodeClick, onPaneClick } = useVueFlow(FLOW_ID)

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

const root = ref<HTMLElement | null>(null)

// Center only once Vue Flow has measured the pane at its current size (the side panel may have just narrowed it).
watch(
  [() => selection.pendingFocusId, nodes, dimensions],
  ([id]) => {
    if (!id) return
    if (error.value) return selection.focusDone()
    const el = root.value
    if (
      !el ||
      el.clientWidth !== dimensions.value.width ||
      el.clientHeight !== dimensions.value.height
    )
      return
    if (centerOnPerson(id)) selection.focusDone()
  },
  { flush: 'post' },
)
</script>

<template>
  <div ref="root" data-testid="tree-canvas" class="relative h-full min-h-0 w-full">
    <p
      v-if="error"
      role="alert"
      class="absolute inset-x-0 top-0 z-10 p-6 text-destructive pointer-events-none"
    >
      {{ error }}
    </p>
    <VueFlow
      :id="FLOW_ID"
      :nodes="flow.nodes"
      :edges="flow.edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="false"
      :delete-key-code="null"
      :selection-key-code="null"
      :min-zoom="0.02"
    >
      <template #node-person="{ data: nodeData }">
        <PersonNode
          v-if="nodeData.view"
          :view="nodeData.view"
          :photo-url="nodeData.photoUrl"
          :selected="nodeData.view.personId === selection.selectedPersonId"
          :editable="editable"
          @add="(kind) => $emit('add', nodeData.view.personId, kind)"
        />
      </template>
      <MiniMap position="bottom-right" pannable zoomable />
      <Controls position="bottom-left" />
    </VueFlow>
  </div>
</template>
