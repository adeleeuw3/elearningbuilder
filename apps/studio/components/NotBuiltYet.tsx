/**
 * NotBuiltYet — an honest placeholder for routes the rail links to but that no milestone has
 * delivered yet. It states what will live here and which milestone owns it, rather than
 * pretending to be a screen.
 */
import { Card, Chip } from "@ob/ui";

export function NotBuiltYet({
  title,
  milestone,
  children,
}: {
  title: string;
  milestone: string;
  children: React.ReactNode;
}) {
  return (
    <Card panel className="p-8">
      <Chip tone="rest">{milestone}</Chip>
      <h1 className="mt-3 text-3xl font-bold -tracking-[0.02em]">{title}</h1>
      <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">{children}</p>
      <p className="mt-4 text-[13px] text-ink-faint">
        The interaction design for this screen is specified in{" "}
        <code className="rounded-control bg-card-sub px-1.5 py-0.5">
          plans/03-ui-ux-design-plan.md
        </code>{" "}
        and prototyped in{" "}
        <code className="rounded-control bg-card-sub px-1.5 py-0.5">design/ui-mockups.html</code>.
      </p>
    </Card>
  );
}
