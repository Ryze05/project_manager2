import { Badge } from "@/components/ui";
import type { TaskPriority } from "@/lib/types";

const PRIORITY: Record<TaskPriority, { label: string; tone: "danger" | "neutral" | "outline" }> = {
  HIGH: { label: "Alta", tone: "danger" },
  MEDIUM: { label: "Media", tone: "neutral" },
  LOW: { label: "Baja", tone: "outline" },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { label, tone } = PRIORITY[priority];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}
