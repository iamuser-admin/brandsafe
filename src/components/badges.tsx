import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DECISION_STYLE, SEVERITY_STYLE, STATE_META } from "@/lib/format";
import type { Decision, VideoState } from "@/lib/types";

export function DecisionBadge({ decision }: { decision: Decision }) {
  const s = DECISION_STYLE[decision];
  return (
    <Badge variant="outline" className={cn("font-semibold", s.className)}>
      {s.label}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.low)}>
      {severity}
    </Badge>
  );
}

export function StateBadge({ state }: { state: VideoState }) {
  const s = STATE_META[state];
  return (
    <Badge variant="outline" className={cn(s.className)}>
      {s.label}
    </Badge>
  );
}
