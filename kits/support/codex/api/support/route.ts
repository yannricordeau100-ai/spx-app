import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { emailOK, escapeHTML, validate } from './validation';
export const runtime = 'nodejs';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function env(name: string): string { const v = process.env[name]; if (!v) throw new Error('Configuration absente'); return v; }
async function currentEmail(): Promise<string> {
  const jar = await cookies();
  const client = createServerClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    cookies: { getAll: () => jar.getAll(), setAll: values => { for (const { name, value, options } of values) jar.set(name, value, options); } },
  });
  const { data, error } = await client.auth.getUser();
  return error ? '' : data.user?.email ?? '';
}
export async function GET() {
  try { return reply({ email: await currentEmail() }); } catch { return reply({ email: '' }); }
}
async function limitedBody(request: Request): Promise<unknown> {
  if (!request.body) throw new Error('Corps absent');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 730000) { await reader.cancel(); throw new Error('Demande trop volumineuse'); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(env('SUPPORT_ORIGIN')).origin) return reply({ error: 'Origine refusée.' }, 403);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return reply({ error: 'Format attendu : JSON.' }, 415);
    let ticket;
    try { ticket = validate(await limitedBody(request)); } catch (e) { return reply({ error: e instanceof Error && ! (e instanceof SyntaxError) ? e.message : 'Demande invalide.' }, 400); }
    if (ticket.website) return reply({ message: 'Demande reçue.' });
    const authenticatedEmail = await currentEmail();
    if (authenticatedEmail) ticket.email = authenticatedEmail.trim().toLowerCase();
    if (!emailOK(ticket.email)) return reply({ error: 'Adresse e-mail invalide.' }, 400);
    const base = env('NEXT_PUBLIC_SUPABASE_URL'); const key = env('SUPABASE_SERVICE_ROLE_KEY');
    const support = env('SUPPORT_EMAIL'); const from = env('SUPPORT_FROM_EMAIL'); const resendKey = env('RESEND_API_KEY');
    if (!emailOK(support) || !emailOK(from)) throw new Error('Configuration e-mail invalide');
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    const inserted = await fetch(`${base}/rest/v1/rpc/create_support_ticket`, { method: 'POST', headers, body: JSON.stringify({ p_email: ticket.email, p_subject: ticket.subject, p_category: ticket.category, p_message: ticket.message, p_capture: ticket.capture }), signal: AbortSignal.timeout(15000) });
    if (!inserted.ok) { const error = await inserted.json() as { message?: string }; if (error.message === 'SUPPORT_RATE_LIMIT') return Response.json({ error: 'Limite de 5 tickets par heure atteinte. Réessayez dans une heure.' }, { status: 429, headers: { 'Retry-After': '3600', 'Cache-Control': 'no-store' } }); throw new Error('Insertion échouée'); }
    const id: unknown = await inserted.json(); if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw new Error('Référence invalide');
    const send = async (kind: string, to: string, subject: string, html: string, attachment: boolean): Promise<boolean> => {
      try { const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `support-${id}-${kind}` }, body: JSON.stringify({ from, to: [to], subject, html, ...(kind === 'notification' ? { reply_to: ticket.email } : {}), ...(attachment && ticket.capture ? { attachments: [{ filename: 'capture.png', content: ticket.capture.slice(22) }] } : {}) }), signal: AbortSignal.timeout(10000) }); return r.ok; } catch { return false; }
    };
    const [supportSent, receiptSent] = await Promise.all([
      send('notification', support, `Ticket Mettrik ${id}`, `<p>Référence : ${id}</p><p>${escapeHTML(ticket.email)}</p><p>${escapeHTML(ticket.category)} : ${escapeHTML(ticket.subject)}</p><pre>${escapeHTML(ticket.message)}</pre>`, true),
      send('reception', ticket.email, `Votre demande Mettrik ${id}`, `<p>Votre demande a été enregistrée sous la référence ${id}.</p><p>Sujet : ${escapeHTML(ticket.subject)}</p><p>Conservez cette référence. Aucun délai de réponse n’est confirmé dans cet accusé.</p>`, false),
    ]);
    let statusSaved = false;
    try { const r = await fetch(`${base}/rest/v1/support_tickets?id=eq.${id}`, { method: 'PATCH', headers, body: JSON.stringify({ support_sent: supportSent, receipt_sent: receiptSent }), signal: AbortSignal.timeout(10000) }); statusSaved = r.ok; } catch { /* Le ticket reste enregistré. */ }
    return reply({ id, message: supportSent && receiptSent && statusSaved ? 'Ticket enregistré. Les deux e-mails ont été acceptés pour envoi.' : 'Ticket enregistré. La confirmation des e-mails est incomplète. Conservez la référence et ne renvoyez pas votre demande.' }, 201);
  } catch { return reply({ error: 'Service indisponible ou enregistrement non confirmé. Avant de réessayer, vérifiez si un accusé de réception vous est parvenu.' }, 503); }
}
