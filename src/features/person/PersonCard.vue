<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import type { FactView, PartnerView, PersonCardView } from './person-card-view'

const props = defineProps<{ view: PersonCardView; photoUrl?: string; canEdit: boolean }>()
defineEmits<{ select: [personId: string]; edit: [] }>()

function hasContent(fact: FactView | undefined): fact is FactView {
  return fact !== undefined && (fact.date !== '' || fact.place !== '')
}

function factText(fact: FactView): string {
  return [fact.date, fact.place].filter((part) => part !== '').join(', ')
}

function unionText(partner: PartnerView): string {
  const period = [partner.start?.date, partner.end ? `do ${partner.end}` : ''].filter(
    (part) => part !== undefined && part !== '',
  )
  return [partner.unionType, ...period].join(', ')
}

const facts = computed(() =>
  [
    { title: 'Urodzenie', fact: props.view.birth },
    { title: 'Śmierć', fact: props.view.death },
  ].flatMap(({ title, fact }) => (hasContent(fact) ? [{ title, fact }] : [])),
)

const relations = computed(() =>
  [
    { title: 'Rodzice', links: props.view.parents.map((p) => ({ ...p, detail: '' })) },
    {
      title: 'Partnerzy',
      links: props.view.partners.map((p) => ({ ...p, detail: unionText(p) })),
    },
    { title: 'Dzieci', links: props.view.children.map((p) => ({ ...p, detail: '' })) },
    { title: 'Rodzeństwo', links: props.view.siblings.map((p) => ({ ...p, detail: '' })) },
  ].filter((section) => section.links.length > 0),
)
</script>

<template>
  <article data-testid="person-card" class="space-y-4">
    <header class="flex items-start gap-3">
      <img
        v-if="photoUrl"
        :src="photoUrl"
        :alt="view.displayName"
        class="size-16 shrink-0 rounded-full object-cover"
      />
      <div class="min-w-0 flex-1">
        <h2 class="text-lg font-semibold">{{ view.displayName }}</h2>
        <p v-if="view.maidenLine" class="text-sm text-muted-foreground">{{ view.maidenLine }}</p>
      </div>
      <Button v-if="canEdit" size="sm" @click="$emit('edit')">Edytuj</Button>
    </header>

    <section v-for="{ title, fact } in facts" :key="title">
      <h3 class="text-sm font-medium text-muted-foreground">{{ title }}</h3>
      <p>
        {{ factText(fact) }}
        <span
          v-if="fact.unconfirmed"
          class="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900"
          >do potwierdzenia</span
        >
      </p>
    </section>

    <section v-for="{ title, links } in relations" :key="title">
      <h3 class="text-sm font-medium text-muted-foreground">{{ title }}</h3>
      <ul>
        <li v-for="link in links" :key="link.personId">
          <button
            type="button"
            class="text-left hover:underline"
            @click="$emit('select', link.personId)"
          >
            {{ link.displayName }}
            <span class="text-sm text-muted-foreground">{{ link.lifeSpan }}</span>
          </button>
          <span v-if="link.detail" class="block text-sm text-muted-foreground">
            {{ link.detail }}
          </span>
        </li>
      </ul>
    </section>

    <section v-if="view.bioHtml">
      <h3 class="text-sm font-medium text-muted-foreground">Biografia</h3>
      <!-- eslint-disable-next-line vue/no-v-html -- wyłącznie wynik renderMarkdown (html: false) -->
      <div class="space-y-2 text-sm" v-html="view.bioHtml" />
    </section>

    <section
      v-if="view.researchNotes"
      data-testid="research-notes"
      class="rounded-md border border-amber-300 bg-amber-50 p-3"
    >
      <h3 class="text-sm font-medium text-amber-900">Notatki badawcze</h3>
      <p class="whitespace-pre-wrap text-sm">{{ view.researchNotes }}</p>
    </section>
  </article>
</template>
