"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addToWatchlist } from "@/app/radar/actions";

export function WatchlistAdd() {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  function action(fd: FormData) {
    start(async () => {
      const r = await addToWatchlist(fd);
      if (r.error) { toast.error(r.error); return; }
      ref.current?.reset();
      toast.success("Adicionado ao Radar.");
    });
  }

  return (
    <form ref={ref} action={action} className="flex gap-2">
      <input
        name="query"
        required
        placeholder="Nome, ticker ou ISIN"
        className="flex-1 min-w-0 rounded-2xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-gold"
      />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1.5 rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink disabled:opacity-50"
      >
        <Plus size={16} />
        {pending ? "…" : "Seguir"}
      </button>
    </form>
  );
}
