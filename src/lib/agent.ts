import type { WorkRun, WorkStep } from '@/types';

function step(id: string, label: string): WorkStep {
  return { id, label, status: 'pending' };
}

export function repoWorkRun(repoLabel: string): WorkRun {
  return {
    id: `work-${Date.now().toString(36)}`,
    kind: 'repo',
    title: `Understanding repository: ${repoLabel}`,
    status: 'running',
    startedAt: Date.now(),
    steps: [
      step('open', 'Opened repository'),
      step('tree', 'Read repository structure'),
      step('files', 'Found relevant files'),
      step('entry', 'Identified entry points'),
      step('deps', 'Traced dependencies'),
      step('answer', 'Building answer'),
    ],
  };
}

export function webWorkRun(url: string): WorkRun {
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {
    // keep raw
  }
  return {
    id: `work-${Date.now().toString(36)}`,
    kind: 'web',
    title: `Inspecting website: ${host}`,
    status: 'running',
    startedAt: Date.now(),
    steps: [
      step('open', 'Opened webpage'),
      step('structure', 'Captured page structure'),
      step('nav', 'Inspected navigation'),
      step('visual', 'Examined visual hierarchy'),
      step('layout', 'Analyzed layout'),
      step('responsive', 'Checked responsive structure'),
      step('components', 'Identified reusable components'),
    ],
  };
}

export function planWorkRun(): WorkRun {
  return {
    id: `work-${Date.now().toString(36)}`,
    kind: 'plan',
    title: 'Working through your request',
    status: 'running',
    startedAt: Date.now(),
    steps: [
      step('goal', 'Understanding the goal'),
      step('arch', 'Checking the existing architecture'),
      step('files', 'Identifying affected files'),
      step('plan', 'Building implementation plan'),
    ],
  };
}

export function markStep(run: WorkRun, id: string, patch: Partial<WorkStep>): WorkRun {
  return {
    ...run,
    steps: run.steps.map((s) =>
      s.id === id ? { ...s, ...patch } : s
    ),
  };
}

export function activateStep(run: WorkRun, id: string, detail?: string): WorkRun {
  return {
    ...run,
    steps: run.steps.map((s) =>
      s.id === id
        ? { ...s, status: 'active', ...(detail !== undefined ? { detail } : {}) }
        : s.status === 'active'
          ? { ...s, status: 'done' as const }
          : s
    ),
  };
}

export function completeStep(run: WorkRun, id: string, detail?: string): WorkRun {
  return markStep(run, id, { status: 'done', ...(detail !== undefined ? { detail } : {}) });
}

export function failStep(run: WorkRun, id: string, detail?: string): WorkRun {
  return markStep(run, id, { status: 'error', ...(detail !== undefined ? { detail } : {}) });
}

/** Mark completed steps as weak-evidence: done, but the underlying
 *  material was thin (e.g. 301 readable chars from a JS shell). */
export function weaken(run: WorkRun): WorkRun {
  return {
    ...run,
    steps: run.steps.map((s) =>
      s.status === 'done' || s.status === 'active' ? { ...s, weak: true } : s
    ),
  };
}

export function finishRun(run: WorkRun, summary?: string, status: 'done' | 'error' = 'done'): WorkRun {
  return {
    ...run,
    status,
    summary,
    endedAt: Date.now(),
    steps: run.steps.map((s) =>
      s.status === 'active' ? { ...s, status: status === 'done' ? 'done' as const : 'error' as const } : s
    ),
  };
}
