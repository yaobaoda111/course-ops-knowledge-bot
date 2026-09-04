export type DeadlineStatus = "on_track" | "due_soon" | "overdue";

export function deadlineStatus(dueAt: string, completedAt: string | null, now: Date): DeadlineStatus {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) throw new Error("dueAt must be an ISO date");
  if (completedAt !== null || due.getTime() < now.getTime()) {
    return completedAt !== null ? "on_track" : "overdue";
  }
  const hoursLeft = (due.getTime() - now.getTime()) / 3_600_000;
  return hoursLeft <= 48 ? "due_soon" : "on_track";
}
