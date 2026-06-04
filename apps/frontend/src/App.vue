<script setup lang="ts">
import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

/** If session ends while on a protected page, leave immediately (e.g. Sign out). */
watch(
  () => auth.user,
  (user, previousUser) => {
    if (previousUser && !user && route.meta.requiresAuth) {
      void router.replace({ name: 'login' });
    }
  },
);
</script>

<template>
  <router-view />
</template>
