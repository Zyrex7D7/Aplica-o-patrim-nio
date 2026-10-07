"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/format";
import { BOTTOM_NAV_ITEMS, MORE_PATHS } from "@/lib/nav-items";

export function BottomNav() {
  const pathname = usePathname() ?? "";
  if (pathname === "/login") return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active =
            item.href === "/mais"
              ? MORE_PATHS.some((p) => pathname.startsWith(p))
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 text-[11px] border-t-2 transition-colors",
                active ? "text-gold border-gold" : "text-text-muted border-transparent"
              )}
            >
              <Icon size={22} strokeWidth={active ? 2 : 1.75} />
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
