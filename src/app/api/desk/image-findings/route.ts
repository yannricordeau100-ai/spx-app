import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  listRequests,
  upsertRequest,
  deleteRequest,
  markClaudePending,
} from "@/lib/desk/image-findings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  await requireDeskOwner();
  const rows = await listRequests();
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  await requireDeskOwner();
  const body = await req.json();
  if (body.action === "mark_claude_pending" && body.id) {
    // 1. Update BDD status='claude_pending'
    await markClaudePending(body.id);

    // 2. Déclenche le worker GitHub Action via workflow_dispatch
    //    (calque sur /api/vip-inspection/route.ts lignes 132-160).
    //    Yann 18 mai 2026 : autonomie totale, plus besoin de taper
    //    "lance la demande N" dans une conv Claude.
    let webhook_hint = "Worker GitHub Action exécutera la demande au prochain cron (max 2h).";
    const ghToken = process.env.GITHUB_DISPATCH_TOKEN;
    if (ghToken) {
      try {
        const resp = await fetch(
          "https://api.github.com/repos/yannricordeau100-ai/spx-app/actions/workflows/image-findings-autorun.yml/dispatches",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ghToken}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({
              ref: "main",
              inputs: { request_id: body.id },
            }),
          },
        );
        if (resp.ok) {
          webhook_hint = `Worker GitHub Action déclenché immédiatement (workflow_dispatch, demande=${body.id}). Démarre en ~30s.`;
        } else {
          const errBody = await resp.text().catch(() => "");
          const errMsg = `Webhook fail HTTP ${resp.status}: ${errBody.slice(0, 200)}`;
          webhook_hint = `${errMsg}. Fallback : cron 2h.`;
          // Persiste l'erreur en BDD pour l'UI (cloche notification)
          try {
            const supa = admin();
            await supa
              .from("desk_image_findings_requests")
              .update({ error_msg: errMsg })
              .eq("id", body.id);
          } catch (e) {
            console.error("update error_msg fail:", e);
          }
        }
      } catch (e) {
        const errMsg = `Webhook error: ${String(e).slice(0, 200)}`;
        webhook_hint = `${errMsg}. Fallback : cron 2h.`;
        try {
          const supa = admin();
          await supa
            .from("desk_image_findings_requests")
            .update({ error_msg: errMsg })
            .eq("id", body.id);
        } catch (err) {
          console.error("update error_msg fail:", err);
        }
      }
    }

    return NextResponse.json({ ok: true, hint: webhook_hint });
  }
  const row = await upsertRequest(body);
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  await requireDeskOwner();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteRequest(id);
  return NextResponse.json({ ok: true });
}
