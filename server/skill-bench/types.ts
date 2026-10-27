export interface CaseChecks {
  mustContain?: string[];
  mustNotContain?: string[];
  judge?: string;
}

export interface SkillCase {
  id: string;
  prompt: string;
  checks: CaseChecks;
}

export interface CheckResult {
  kind: 'mustContain' | 'mustNotContain' | 'judge';
  detail: string;
  pass: boolean;
}

export interface CaseRun {
  output: string;
  results: CheckResult[];
  pass: boolean;
  error?: string;
}

export type Runner = (prompt: string, systemPrompt: string | null) => Promise<string>;

export interface CaseDiff {
  id: string;
  old: CaseRun;
  new: CaseRun;
  verdict: 'same-pass' | 'same-fail' | 'regressed' | 'fixed';
}

export interface BenchReport {
  skill: string;
  baseRef: string;
  cases: CaseDiff[];
  calls: number;
}
