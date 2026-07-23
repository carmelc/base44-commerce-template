import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

/**
 * Page title row.
 * Props: { title, description?, actions? (node), backHref? }
 */
export default function PageHeader({ title, description, actions, backHref }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        {backHref && (
          <Button variant="ghost" size="icon" asChild className="mt-0.5 h-8 w-8">
            <Link to={backHref}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
