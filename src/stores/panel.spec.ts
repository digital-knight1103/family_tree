import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePanelStore } from '@/stores/panel'
import { useSelectionStore } from '@/stores/selection'

describe('usePanelStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('bez zaznaczenia panel jest zamknięty', () => {
    expect(usePanelStore().view).toEqual({ kind: 'closed' })
  })

  it('zaznaczenie otwiera kartę osoby', () => {
    useSelectionStore().select('p_1')
    expect(usePanelStore().view).toEqual({ kind: 'card', personId: 'p_1' })
  })

  it('openAdd dla zaznaczonej osoby pokazuje formularz dodawania', () => {
    useSelectionStore().select('p_1')
    const panel = usePanelStore()
    panel.openAdd('p_1', 'child')
    expect(panel.view).toEqual({ kind: 'add', anchorId: 'p_1', relation: 'child' })
  })

  it('openEdit pokazuje edycję, a showCard wraca do karty', () => {
    useSelectionStore().select('p_1')
    const panel = usePanelStore()
    panel.openEdit('p_1')
    expect(panel.view).toEqual({ kind: 'edit', personId: 'p_1' })
    panel.showCard()
    expect(panel.view).toEqual({ kind: 'card', personId: 'p_1' })
  })

  it('zmiana zaznaczenia wraca do karty nowej osoby', () => {
    const selection = useSelectionStore()
    selection.select('p_1')
    const panel = usePanelStore()
    panel.openAdd('p_1', 'parent')
    selection.select('p_2')
    expect(panel.view).toEqual({ kind: 'card', personId: 'p_2' })
    selection.select('p_1')
    expect(panel.view).toEqual({ kind: 'card', personId: 'p_1' })
  })

  it('zdjęcie zaznaczenia zamyka panel mimo trybu edycji', () => {
    const selection = useSelectionStore()
    selection.select('p_1')
    const panel = usePanelStore()
    panel.openEdit('p_1')
    selection.select(null)
    expect(panel.view).toEqual({ kind: 'closed' })
  })

  it('openReview pokazuje listę także bez zaznaczenia', () => {
    const panel = usePanelStore()
    panel.openReview()
    expect(panel.view).toEqual({ kind: 'review' })
    useSelectionStore().select('p_1')
    expect(panel.view).toEqual({ kind: 'card', personId: 'p_1' })
  })

  it('openCard z listy dla już zaznaczonej osoby pokazuje kartę', () => {
    const selection = useSelectionStore()
    selection.select('p_1')
    const panel = usePanelStore()
    panel.openReview()
    panel.openCard('p_1', { fromReview: true })
    expect(panel.view).toEqual({ kind: 'card', personId: 'p_1' })
    expect(selection.pendingFocusId).toBe('p_1')
    expect(panel.canReturnToReview).toBe(true)
  })

  it('powrót do listy przetrwa edycję, ale nie zmianę zaznaczenia', () => {
    const panel = usePanelStore()
    panel.openCard('p_1', { fromReview: true })
    panel.openEdit('p_1')
    expect(panel.canReturnToReview).toBe(false)
    panel.showCard()
    expect(panel.canReturnToReview).toBe(true)
    useSelectionStore().select('p_2')
    expect(panel.canReturnToReview).toBe(false)
  })

  it('openCard bez fromReview nie pozwala wrócić do listy', () => {
    const panel = usePanelStore()
    panel.openCard('p_1', { fromReview: true })
    panel.openCard('p_1')
    expect(panel.canReturnToReview).toBe(false)
  })

  it('close zamyka panel także z listy', () => {
    const panel = usePanelStore()
    panel.openCard('p_1')
    panel.openReview()
    panel.close()
    expect(panel.view).toEqual({ kind: 'closed' })
    expect(useSelectionStore().selectedPersonId).toBeNull()
  })
})
