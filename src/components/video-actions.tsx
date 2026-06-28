"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Megaphone, Mail, XCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function VideoActions({
  videoId,
  canPromote,
  promoted,
  size = "default",
  allowRevision = true,
  onDone,
}: {
  videoId: string;
  canPromote: boolean;
  promoted?: boolean;
  size?: "default" | "sm";
  /** Show "Request Revision" when not promotable. */
  allowRevision?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function done() {
    router.refresh();
    onDone?.();
  }

  async function act(type: "promote" | "drop") {
    setBusy(type);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Action failed");
        return;
      }
      toast.success(type === "drop" ? "Video dropped" : "Promoted to Paid Ad Creative");
      done();
    } finally {
      setBusy(null);
    }
  }

  async function requestRevision() {
    setBusy("request_revision");
    setOpen(true);
    setTemplate(null);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, type: "request_revision" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not generate message");
        setOpen(false);
        return;
      }
      setTemplate(data.template ?? "");
      done();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canPromote ? (
        <Button size={size} onClick={() => act("promote")} disabled={!!busy || promoted}>
          {busy === "promote" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
          {promoted ? "Promoted" : "Promote to Paid Ad Creative"}
        </Button>
      ) : (
        allowRevision && (
          <Button size={size} onClick={requestRevision} disabled={!!busy}>
            {busy === "request_revision" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Request Revision
          </Button>
        )
      )}
      <Button size={size} variant="outline" onClick={() => act("drop")} disabled={!!busy}>
        <XCircle className="h-4 w-4" />
        Drop
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revision request for the creator</DialogTitle>
            <DialogDescription>
              Drafted from the compliance findings. The video is marked “revision requested”. Review, edit, and send.
            </DialogDescription>
          </DialogHeader>
          {template == null ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Generating message…
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="max-h-[55vh] min-h-56 overflow-y-auto text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(template);
                  toast.success("Copied to clipboard");
                }}
              >
                <Copy className="h-4 w-4" /> Copy
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
