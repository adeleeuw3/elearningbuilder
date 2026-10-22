/**
 * Shell — app header + NavigationView rail. The rail's selected item is derived from the
 * current route, so navigation state has exactly one source of truth.
 */
"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button, Chip, NavigationView, type NavItem } from "@ob/ui";

const ITEMS: readonly NavItem[] = [
  { id: "/workflow", label: "Workflow", icon: "⌗" },
  { id: "/scene", label: "Scene editor", icon: "▦" },
  { id: "/preview", label: "Learner preview", icon: "◉" },
  { id: "/settings", label: "Settings", icon: "◐" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const selected = ITEMS.find((i) => pathname.startsWith(i.id))?.id ?? "/workflow";

  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-14 pt-5 sm:px-8">
      <header className="mb-5 flex flex-wrap items-center gap-3.5">
        <div className="mr-auto flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-[34px] w-[34px] place-items-center rounded-card bg-grad-flow text-base font-bold text-flow-on shadow-glow-flow"
          >
            O
          </span>
          <span>
            <b className="block text-base font-bold -tracking-[0.01em]">Observation Builder</b>
            <span className="block text-[11px] font-medium tracking-[0.06em] text-ink-faint">
              PRISM · STUDIO
            </span>
          </span>
        </div>
        <Chip tone="glow">Draft</Chip>
        <Button size="sm">Share</Button>
        <Button role_="accent" size="sm">
          Publish
        </Button>
      </header>

      <div className="grid items-start gap-5 md:grid-cols-[210px_1fr]">
        <NavigationView
          items={ITEMS}
          selectedId={selected}
          onSelect={(id) => router.push(id)}
          dividerAfter={["/preview"]}
          label="Studio sections"
          className="md:sticky md:top-3.5"
        />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
