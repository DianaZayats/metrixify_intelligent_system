import type { VerifyReport } from './verify.js';

export function printAnalyzeReport(params: {
  personaId: string;
  userId: string;
  diaryDays: number;
  pipelineCompleted: number;
  pipelineFailed: number;
  verify: VerifyReport;
}): void {
  const prefix = `[persona:analyze] ${params.personaId}`;
  console.log(`${prefix} — ${params.diaryDays} diary days, user ${params.userId}`);
  console.log('');
  console.log('PIPELINE');
  console.log(`  entries: ${params.pipelineCompleted}/${params.diaryDays} completed`);
  if (params.pipelineFailed > 0) {
    console.log(`  failed: ${params.pipelineFailed}`);
  }
  console.log('');
  console.log('ANALYTICS');
  console.log(`  pairs computed: ${params.verify.pairsComputed}`);
  console.log(`  pairs above threshold: ${params.verify.pairsAboveThreshold}`);
  console.log('');
  console.log('EXPECTED CORRELATIONS');
  for (const check of params.verify.expectedChecks.filter((c) => c.required)) {
    const mark = check.status === 'FOUND' ? '✓' : '✗';
    console.log(`  ${mark} ${check.label} — ${check.detail}`);
  }
  const optional = params.verify.expectedChecks.filter((c) => !c.required);
  if (optional.length > 0) {
    console.log('');
    console.log('OPTIONAL CORRELATIONS');
    for (const check of optional) {
      const mark = check.status === 'FOUND' ? '✓' : '○';
      console.log(`  ${mark} ${check.label} — ${check.detail}`);
    }
  }
  if (params.verify.extras.length > 0) {
    console.log('');
    console.log('EXTRA CORRELATIONS (informational)');
    for (const extra of params.verify.extras.slice(0, 10)) {
      console.log(`  • ${extra.label} — ${extra.detail}`);
    }
    if (params.verify.extras.length > 10) {
      console.log(`  • … and ${params.verify.extras.length - 10} more`);
    }
  }
  console.log('');
  if (params.verify.failedRequired > 0 || params.pipelineFailed > 0) {
    console.log(`RESULT: FAIL (${params.verify.failedRequired} required miss, ${params.pipelineFailed} pipeline failures)`);
  } else {
    console.log('RESULT: PASS');
  }
}
