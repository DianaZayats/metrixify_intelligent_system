import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import JournalPage from '../pages/JournalPage.vue';
import EntryDetailPage from '../pages/EntryDetailPage.vue';
import MetricsPage from '../pages/MetricsPage.vue';
import MetricDetailPage from '../pages/MetricDetailPage.vue';
import ProfileFactsPage from '../pages/ProfileFactsPage.vue';
import CorrelationsPage from '../pages/CorrelationsPage.vue';
import CorrelationDetailPage from '../pages/CorrelationDetailPage.vue';
import InsightsPage from '../pages/InsightsPage.vue';
import MorePage from '../pages/MorePage.vue';
import LoginPage from '../pages/LoginPage.vue';
import AccountPage from '../pages/AccountPage.vue';
import AuthTelegramTokenPage from '../pages/AuthTelegramTokenPage.vue';
import DesignSystemPage from '../pages/DesignSystemPage.vue';
import { useAuthStore } from '../stores/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage, meta: { requiresAuth: true } },
    {
      path: '/design-system',
      name: 'design-system',
      component: DesignSystemPage,
    },
    { path: '/login', name: 'login', component: LoginPage },
    {
      path: '/auth/telegram-token',
      name: 'auth-telegram-token',
      component: AuthTelegramTokenPage,
    },
    {
      path: '/journal',
      name: 'journal',
      component: JournalPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/metrics',
      name: 'metrics',
      component: MetricsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/metrics/:id',
      name: 'metric',
      component: MetricDetailPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/correlations',
      name: 'correlations',
      component: CorrelationsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/correlations/:id',
      name: 'correlation',
      component: CorrelationDetailPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/insights',
      name: 'insights',
      component: InsightsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/profile-facts',
      name: 'profile-facts',
      component: ProfileFactsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/more',
      name: 'more',
      component: MorePage,
      meta: { requiresAuth: true },
    },
    {
      path: '/account',
      name: 'account',
      component: AccountPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/journal/:id',
      name: 'entry',
      component: EntryDetailPage,
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) {
    return true;
  }

  const auth = useAuthStore();
  await auth.refreshSession();

  if (!auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  return true;
});
