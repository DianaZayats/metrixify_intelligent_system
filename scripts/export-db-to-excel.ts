import { config as loadDotenv } from 'dotenv';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const EXCEL_CELL_LIMIT = 32_000;

function findEnvFilePath(): string {
  let dir = resolve(import.meta.dirname, '..');
  while (true) {
    const envPath = resolve(dir, '.env');
    if (existsSync(envPath)) {
      return envPath;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return resolve(process.cwd(), '.env');
}

function serializeCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    if (json.length > EXCEL_CELL_LIMIT) {
      return `${json.slice(0, EXCEL_CELL_LIMIT)}…[truncated]`;
    }
    return json;
  }
  if (typeof value === 'string' && value.length > EXCEL_CELL_LIMIT) {
    return `${value.slice(0, EXCEL_CELL_LIMIT)}…[truncated]`;
  }
  return value as string | number | boolean;
}

function rowsToSheet(rows: Record<string, unknown>[]): XLSX.WorkSheet {
  if (rows.length === 0) {
    return XLSX.utils.aoa_to_sheet([['(empty)']]);
  }

  const serialized = rows.map((row) => {
    const out: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = serializeCell(value);
    }
    return out;
  });

  return XLSX.utils.json_to_sheet(serialized);
}

async function main(): Promise<void> {
  loadDotenv({ path: findEnvFilePath() });

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required');
  }

  const prisma = new PrismaClient();
  const outputArg = process.argv.find((arg) => arg.startsWith('--out='));
  const defaultName = `metrixify-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const outputPath = resolve(
    process.cwd(),
    outputArg?.slice('--out='.length) ?? resolve(process.cwd(), 'exports', defaultName),
  );
  mkdirSync(dirname(outputPath), { recursive: true });

  const workbook = XLSX.utils.book_new();

  const sheets: Array<{ name: string; rows: Record<string, unknown>[] }> = [
    { name: 'users', rows: await prisma.user.findMany() },
    { name: 'telegram_accounts', rows: await prisma.telegramAccount.findMany() },
    { name: 'sessions', rows: await prisma.session.findMany() },
    { name: 'login_tokens', rows: await prisma.loginToken.findMany() },
    { name: 'diary_entries', rows: await prisma.diaryEntry.findMany() },
    { name: 'entry_sources', rows: await prisma.entrySource.findMany() },
    { name: 'prompt_versions', rows: await prisma.promptVersion.findMany() },
    { name: 'ai_runs', rows: await prisma.aiRun.findMany() },
    { name: 'metric_definitions', rows: await prisma.metricDefinition.findMany() },
    { name: 'metric_observations', rows: await prisma.metricObservation.findMany() },
    { name: 'profile_facts', rows: await prisma.profileFact.findMany() },
    { name: 'profile_fact_evidence', rows: await prisma.profileFactEvidence.findMany() },
    {
      name: 'memory_chunks',
      rows: await prisma.$queryRaw<
        Array<{
          id: string;
          user_id: string;
          entry_id: string | null;
          chunk_type: string;
          content: string;
          metadata_json: unknown;
          created_at: Date;
          updated_at: Date;
        }>
      >`
        SELECT id, user_id, entry_id, chunk_type, content, metadata_json, created_at, updated_at
        FROM memory_chunks
        ORDER BY created_at ASC
      `,
    },
    { name: 'correlation_results', rows: await prisma.correlationResult.findMany() },
    { name: 'processing_jobs', rows: await prisma.processingJob.findMany() },
  ];

  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(workbook, rowsToSheet(sheet.rows), sheet.name.slice(0, 31));
    console.log(`${sheet.name}: ${sheet.rows.length} rows`);
  }

  XLSX.writeFile(workbook, outputPath);
  console.log(`\nSaved: ${outputPath}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
