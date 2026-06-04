-- Stage 9: user locale + bilingual display fields for metrics and profile facts

ALTER TABLE "users" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "metric_definitions" ADD COLUMN "title_i18n" JSONB;
ALTER TABLE "metric_definitions" ADD COLUMN "description_i18n" JSONB;
ALTER TABLE "metric_definitions" ADD COLUMN "tags_i18n" JSONB;

ALTER TABLE "profile_facts" ADD COLUMN "value_i18n" JSONB;
