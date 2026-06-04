import { useI18n } from 'vue-i18n';
import { useLocaleStore } from '../stores/locale';

export function useAppLocale() {
  const { t, locale } = useI18n();
  const localeStore = useLocaleStore();

  function formatDateTime(iso: string | null): string {
    if (!iso) {
      return t('common.dash');
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso.slice(0, 10);
    }
    const intlLocale = localeStore.locale === 'uk' ? 'uk-UA' : 'en-GB';
    return date.toLocaleString(intlLocale, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function enumLabel(group: string, value: string): string {
    const key = `enums.${group}.${value}`;
    const translated = t(key);
    return translated === key ? value : translated;
  }

  return {
    t,
    locale,
    localeStore,
    formatDateTime,
    enumLabel,
  };
}
