export function TaskProgress({ label }: { label: string }) {
  return <p className="progress" aria-label="Task progress">Tasks {label}</p>;
}
