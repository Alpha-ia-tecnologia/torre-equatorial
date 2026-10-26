import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { assessments, auditLog } from "../../../db/schema";

export async function GET() {
  try {
    const rows = await getDb().select().from(assessments).orderBy(desc(assessments.updatedAt)).limit(250);
    return Response.json({ assessments: rows });
  } catch {
    return Response.json({ assessments: [], mode: "seed" });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, string | number | null>;
    if (!payload.id || !payload.code || !payload.indicator || !payload.company) {
      return Response.json({ error: "Dados obrigatórios ausentes." }, { status: 400 });
    }
    const db = getDb();
    const existing = await db.select().from(assessments).where(eq(assessments.externalId, Number(payload.id))).limit(1);
    const values = {
      externalId: Number(payload.id), indicatorCode: String(payload.code), indicatorName: String(payload.indicator),
      companyCode: String(payload.company), areaName: String(payload.area), planned: Number(payload.planned),
      actual: payload.actual === null ? null : Number(payload.actual), score: null, owner: String(payload.owner),
    };
    if (existing.length) await db.update(assessments).set(values).where(eq(assessments.externalId, Number(payload.id)));
    else await db.insert(assessments).values(values);
    await db.insert(auditLog).values({
      actor: "Nataldo Costa", action: existing.length ? "Atualizou resultado" : "Criou resultado",
      entity: `${payload.indicator} · ${payload.company}`,
      previousValue: existing[0]?.actual == null ? null : String(existing[0].actual),
      newValue: payload.actual == null ? null : String(payload.actual),
    });
    return Response.json({ ok: true }, { status: existing.length ? 200 : 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Falha ao salvar." }, { status: 500 });
  }
}
