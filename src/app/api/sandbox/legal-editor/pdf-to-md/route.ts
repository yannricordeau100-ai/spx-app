import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

/**
 * POST /api/sandbox/legal-editor/pdf-to-md
 * multipart/form-data: { file: <PDF blob> }
 *
 * Auth-gate : email Yann.
 * Convertit un PDF en texte brut via pdftotext (poppler), puis applique
 * une heuristique légère pour produire du Markdown utilisable comme point
 * de départ dans l'éditeur (Yann revoit/corrige avant publish).
 *
 * En prod Vercel : pdftotext n'est pas dispo dans la runtime serverless
 * → renvoie 503 avec hint. Conversion se fait en local / preview branch.
 */

async function requireOwner() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, email: user.email };
}

function runPdfToText(pdfPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // -layout préserve la mise en page (utile pour identifier les titres).
    // /opt/homebrew/bin/pdftotext = poppler installé via brew sur Mac Yann.
    const bin = process.env.PDFTOTEXT_BIN || "/opt/homebrew/bin/pdftotext";
    const proc = spawn(bin, ["-layout", "-enc", "UTF-8", pdfPath, "-"]);
    let out = "";
    let err = "";
    proc.stdout.on("data", (chunk) => (out += chunk.toString("utf-8")));
    proc.stderr.on("data", (chunk) => (err += chunk.toString("utf-8")));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`pdftotext exit ${code} ${err.slice(0, 200)}`));
    });
  });
}

/**
 * Heuristique txt → MD :
 * - Première ligne non-vide significative = titre (#)
 * - Lignes UPPERCASE courtes = h2 (##)
 * - Lignes type "X.Y Titre" = h3 (###)
 * - Lignes commençant par "• " ou "- " = bullets
 * - Reste = paragraphes
 */
function txtToMarkdown(raw: string): string {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const out: string[] = [];
  let titleSet = false;
  let prevBlank = true;

  for (const line of lines) {
    if (!line) {
      if (!prevBlank) {
        out.push("");
        prevBlank = true;
      }
      continue;
    }
    if (!titleSet && line.length > 5 && line.length < 120) {
      out.push(`# ${line}`);
      out.push("");
      titleSet = true;
      prevBlank = true;
      continue;
    }
    // Bullets
    if (/^[•·▪◦]\s+/.test(line) || /^[-*]\s+/.test(line)) {
      out.push(`- ${line.replace(/^[•·▪◦\-*]\s+/, "").trim()}`);
      prevBlank = false;
      continue;
    }
    // Numérotation type "1.2 Titre" ou "Article 5 — ..." → h3
    if (
      /^(I{1,3}\.|II\.|III\.)\s?\d+\.?\s+\w/.test(line) ||
      /^\d+(\.\d+){0,2}\s+\w/.test(line) ||
      /^(Article|Chapitre|Section|Partie)\s+/i.test(line)
    ) {
      if (line.length < 120) {
        out.push("");
        out.push(`### ${line}`);
        out.push("");
        prevBlank = true;
        continue;
      }
    }
    // UPPERCASE court → h2
    if (line.length < 80 && line === line.toUpperCase() && /[A-Z]/.test(line)) {
      out.push("");
      out.push(`## ${line}`);
      out.push("");
      prevBlank = true;
      continue;
    }
    out.push(line);
    prevBlank = false;
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export async function POST(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > 10_000_000) {
    return NextResponse.json({ error: "file_too_large", size: file.size }, { status: 413 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const tmpPath = path.join(os.tmpdir(), `legal-${randomUUID()}.pdf`);
  try {
    await fs.writeFile(tmpPath, buf);
    let txt: string;
    try {
      txt = await runPdfToText(tmpPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "pdftotext_failed";
      return NextResponse.json(
        {
          error: "pdftotext_failed",
          detail: message,
          hint: "En prod (Vercel) pdftotext n'est pas dispo. Conversion à faire en local puis paste manuel.",
        },
        { status: 503 },
      );
    }
    const md = txtToMarkdown(txt);
    return NextResponse.json({ ok: true, md, raw_length: txt.length, md_length: md.length });
  } finally {
    fs.unlink(tmpPath).catch(() => {});
  }
}
