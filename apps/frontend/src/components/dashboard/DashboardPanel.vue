<script setup lang="ts">
defineProps<{
  title: string;
  linkTo?: string;
  linkText?: string;
}>();
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <h2 class="panel-head__title typo-h3">{{ title }}</h2>
      <router-link v-if="linkTo && linkText" :to="linkTo" class="panel-head__link">
        {{ linkText }}
      </router-link>
    </div>
    <slot />
  </div>
</template>
