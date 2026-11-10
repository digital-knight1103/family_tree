<template>
  <div data-testid="empty-tree" class="p-6 text-center text-muted-foreground">
    <p class="text-lg">Twoje drzewo jest puste</p>
    <div v-if="$slots.default" class="mx-auto mt-6 max-w-sm text-left text-foreground">
      <slot />
    </div>
  </div>
</template>
