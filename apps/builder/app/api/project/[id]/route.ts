/** GET /api/project/[id] — één bewaarde module terug. DELETE verwijdert hem. */
import { NextResponse } from "next/server";
import { isGeldigId } from "../../../../lib/opslag";
import { schijfOpslag } from "../../../../lib/opslag-schijf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isGeldigId(id)) return NextResponse.json({ fout: true }, { status: 404 });
  const project = await schijfOpslag.laadProject(id);
  if (!project) return NextResponse.json({ fout: true }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const weg = await schijfOpslag.verwijderProject(id);
  return NextResponse.json({ verwijderd: weg }, { status: weg ? 200 : 404 });
}
