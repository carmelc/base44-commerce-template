import React from "react";
import { Inbox } from "lucide-react";

/**
 * Empty-list placeholder.
 * Props: { icon?: LucideIcon, title?, description?, action?: node }
 */
export default function EmptyState({ icon: Icon = Inbox, title = "Nothing here yet", description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40" />
      <div className="text-sm font-medium">{title}</div>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
