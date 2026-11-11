import { useVueFlow } from '@vue-flow/core'
import { PERSON_NODE } from '@/domain/tree-layout'
import { FLOW_ID } from './flow-id'

export function useTreeNavigation() {
  const { findNode, setCenter, fitView } = useVueFlow(FLOW_ID)

  function centerOnPerson(personId: string): boolean {
    const node = findNode(`person:${personId}`)
    if (!node) return false
    void setCenter(
      node.position.x + (node.dimensions.width || PERSON_NODE.width) / 2,
      node.position.y + (node.dimensions.height || PERSON_NODE.height) / 2,
      { zoom: 1 },
    )
    return true
  }

  function fitAll(): void {
    void fitView({ padding: 0.1 })
  }

  return { centerOnPerson, fitAll }
}
