import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useFamilyStore } from '@/stores/family'
import { buildFamily } from '@tests/fixtures/build-family'
import PhotoField from './PhotoField.vue'

vi.mock('@/data', () => ({
  getRepository: () => ({
    photoUrl: (photo: string) => `/__data/photos/${photo}`,
    uploadPhoto: vi.fn(),
    deletePhoto: vi.fn(),
  }),
}))

function setup(photo?: string) {
  const family = useFamilyStore()
  family.status = 'ready'
  family.source = 'user'
  family.data = buildFamily({ persons: [{ id: 'p_a', ...(photo ? { photo } : {}) }] })
}

describe('PhotoField', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('bez zdjęcia pokazuje „Dodaj zdjęcie” i nie pokazuje usuwania', () => {
    setup()
    const wrapper = mount(PhotoField, { props: { personId: 'p_a' } })
    expect(wrapper.text()).toContain('Dodaj zdjęcie')
    expect(wrapper.text()).not.toContain('Usuń zdjęcie')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('ze zdjęciem pokazuje miniaturę, „Zmień zdjęcie” i „Usuń zdjęcie”', () => {
    setup('p_a.webp')
    const wrapper = mount(PhotoField, { props: { personId: 'p_a' } })
    expect(wrapper.text()).toContain('Zmień zdjęcie')
    expect(wrapper.text()).toContain('Usuń zdjęcie')
    expect(wrapper.get('img').attributes('src')).toBe('/__data/photos/p_a.webp')
    expect(wrapper.get('input[type="file"]').attributes('accept')).toBe('image/*')
  })
})
