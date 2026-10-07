"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { removeFromWatchlist } from "@/app/radar/actions";

export function RemoveWatchButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      title="Deixar de seguir"
      onClick={() =>
        start(async () => {
          const r = await removeFromWatchlist(id);
          if (r.error) toast.error(r.error);
        })
      }
      className="text-text-faint hover:text-loss disabled:opacity-50"
    >
      <X size={16} />
    </button>
  );
}
