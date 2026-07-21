import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Webhook as WebhookIcon } from "lucide-react";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import { base44 } from "../../lib/api";
import useAsync from "../../hooks/useAsync";
import { useAdminHref } from "../../context/BasePathContext";
import { WEBHOOK_STATUSES } from "../../lib/constants";
import { formatDate } from "../../lib/format";

export default function Webhooks() {
  const navigate = useNavigate();
  const href = useAdminHref();
  const hooks = useAsync(() => base44.entities.Webhook.list("-created_date", 200), []);

  const columns = [
    { key: "name", label: "Name", render: (w) => <span className="font-medium">{w.name}</span> },
    { key: "status", label: "Status", render: (w) => <StatusBadge status={w.status} map={WEBHOOK_STATUSES} /> },
    { key: "topic", label: "Topic", render: (w) => <code className="text-xs">{w.topic}</code> },
    {
      key: "delivery_url",
      label: "Delivery URL",
      render: (w) => <span className="block max-w-xs truncate text-sm text-muted-foreground">{w.delivery_url}</span>,
    },
    { key: "failure_count", label: "Failures", render: (w) => w.failure_count ?? 0 },
    { key: "created_date", label: "Created", render: (w) => formatDate(w.created_date) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Webhooks"
        description="Notify external services when store events occur."
        actions={
          <Button onClick={() => navigate(href("webhooks/new"))}>
            <Plus className="mr-2 h-4 w-4" />
            Add webhook
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={hooks.data || []}
        loading={hooks.loading}
        onRowClick={(w) => navigate(href(`webhooks/${w.id}`))}
        empty={{ icon: WebhookIcon, title: "No webhooks", description: "Create a webhook to POST event payloads to an external URL." }}
      />
    </div>
  );
}
