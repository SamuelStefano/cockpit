export interface StepRecord {
  name: string;
  ms: number;
  status: 'pass' | 'fail';
  screenshot: string | null;
  detail: string;
}

export interface ReportData {
  target: string;
  startedAt: string;
  steps: StepRecord[];
  notes?: string[];
}

export function fmtDuration(ms: number): string;
export function renderReport(data: ReportData): string;
export function writeReport(dir: string, data: ReportData): string;
export function createRecorder(dir: string): {
  steps: StepRecord[];
  step: (name: string, fn: (rec: StepRecord) => Promise<string | void>) => Promise<StepRecord>;
  dir: string;
};
export function tail(text: string, n?: number): string;
