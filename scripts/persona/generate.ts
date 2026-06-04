#!/usr/bin/env tsx
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertPersonaIdMatches, loadPersonaSpec } from './lib/load.js';
import { generatePersonaDiaryOutput } from './lib/generator.js';
import { getPersonaDiaryDir } from './lib/paths.js';

function usage(): never {
  console.error('Usage: npm run persona:generate -- <persona-id> [--force]');
  process.exit(1);
}

function main(): void {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const personaId = args[0];
  const force = args.includes('--force');

  if (!personaId) {
    usage();
  }

  const spec = loadPersonaSpec(personaId);
  assertPersonaIdMatches(spec, personaId);

  const diaryDir = getPersonaDiaryDir(personaId);
  mkdirSync(diaryDir, { recursive: true });

  const existing = readdirSync(diaryDir).filter((name) => name.endsWith('.md'));
  if (existing.length > 0 && !force) {
    console.log(
      `[persona:generate] ${personaId} — diary already has ${existing.length} files; use --force to regenerate`,
    );
    return;
  }

  const output = generatePersonaDiaryOutput(spec);
  const manifest = output.manifestDays.map((day) => ({
    date: day.date,
    text: day.text,
    signals: day.signals,
  }));

  for (const file of output.files) {
    const filePath = resolve(diaryDir, `${file.entryDate}.md`);
    writeFileSync(filePath, `${file.text}\n`, 'utf8');
  }

  writeFileSync(
    resolve(diaryDir, 'manifest.json'),
    `${JSON.stringify({ personaId: spec.id, days: manifest }, null, 2)}\n`,
    'utf8',
  );

  console.log(
    `[persona:generate] ${personaId} — wrote ${output.files.length} diary files (${output.manifestDays.length} manifest days, format=${spec.diary_format})`,
  );
}

main();
