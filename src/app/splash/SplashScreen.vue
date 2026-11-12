<script setup lang="ts">
import { computed, watch } from 'vue'
import { useEventListener, usePreferredReducedMotion } from '@vueuse/core'
import { SPLASH } from '@/app/splash/splash-config'
import { useSplash } from '@/app/splash/useSplash'

const emit = defineEmits<{ done: [] }>()

const motion = usePreferredReducedMotion()
const { phase, skip } = useSplash({ reducedMotion: computed(() => motion.value === 'reduce') })

watch(
  phase,
  (value) => {
    if (value === 'done') emit('done')
  },
  { immediate: true },
)

useEventListener(
  window,
  'keydown',
  (event: KeyboardEvent) => {
    if (phase.value === 'done') return
    if (event.key !== 'Enter' && event.key !== 'Escape') return
    event.preventDefault()
    event.stopImmediatePropagation()
    skip()
  },
  { capture: true },
)

/** Leaves of the crown: [cx, cy, r]. */
const leaves: [number, number, number][] = [
  [100, 62, 30],
  [70, 78, 24],
  [130, 78, 24],
  [52, 104, 20],
  [148, 104, 20],
  [82, 104, 26],
  [118, 104, 26],
  [100, 92, 22],
  [66, 126, 16],
  [134, 126, 16],
]
</script>

<template>
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Ekran powitalny"
    class="splash fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-8 px-6 text-center transition-opacity duration-600 ease-out"
    :class="{ 'opacity-0': phase === 'leaving' }"
    @click="skip()"
  >
    <svg aria-hidden="true" viewBox="0 0 200 220" class="splash-tree size-44 sm:size-56">
      <circle cx="100" cy="100" r="88" fill="var(--splash-glow)" />
      <path
        d="M96 210 C97 180 95 160 92 140 L86 120 M100 210 C101 175 103 150 108 132 L116 116 M96 158 L76 132 M104 150 L124 136"
        fill="none"
        stroke="var(--splash-trunk)"
        stroke-width="7"
        stroke-linecap="round"
      />
      <circle
        v-for="([cx, cy, r], i) in leaves"
        :key="i"
        :cx="cx"
        :cy="cy"
        :r="r"
        fill="var(--splash-tree)"
        :fill-opacity="0.55 + (i % 3) * 0.15"
      />
    </svg>
    <div class="flex max-w-xl flex-col gap-4">
      <h1
        class="splash-rise font-heading text-4xl font-semibold tracking-tight text-(--splash-title) sm:text-5xl"
      >
        {{ SPLASH.title }}
      </h1>
      <p
        class="splash-rise splash-rise-late text-lg text-balance text-(--splash-quote) italic sm:text-xl"
      >
        {{ SPLASH.quote }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.splash {
  background: radial-gradient(circle at 50% 40%, var(--splash-from), var(--splash-to) 75%);
}

.splash-tree {
  transform-origin: 50% 90%;
  animation: splash-breathe 4s ease-in-out infinite;
}

.splash-rise {
  animation: splash-rise 0.8s ease-out both;
}

.splash-rise-late {
  animation-delay: 0.6s;
}

@media (prefers-reduced-motion: reduce) {
  .splash {
    transition: none;
  }
  .splash-tree,
  .splash-rise {
    animation: none;
  }
}

@keyframes splash-breathe {
  0%,
  100% {
    transform: scale(1);
    filter: brightness(1);
  }
  50% {
    transform: scale(1.03);
    filter: brightness(1.12);
  }
}

@keyframes splash-rise {
  from {
    opacity: 0;
    translate: 0 0.75rem;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
</style>
