'use client';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import faq from '../data/faq.json';
const themes = [...new Set(faq.map(item => item.category))];
export default function SupportTicketForm({ question, initialCategory }: { question: string; initialCategory: string }) {
  const id = useId(); const subjectRef = useRef<HTMLInputElement>(null); const emailEdited = useRef(false);
  const [email, setEmail] = useState(''); const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  useEffect(() => {
    subjectRef.current?.focus(); const controller = new AbortController();
    void fetch('/api/support', { signal: controller.signal, cache: 'no-store' }).then(r => r.json()).then((v: unknown) => { if (!emailEdited.current && v && typeof v === 'object' && 'email' in v && typeof v.email === 'string') setEmail(v.email); }).catch(() => {});
    return () => controller.abort();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || sent) return; setBusy(true); setStatus('Envoi en cours…');
    const values = new FormData(event.currentTarget);
    try {
      const file = values.get('capture'); let capture = '';
      if (file instanceof File && file.size) {
        if (file.type !== 'image/png' || file.size > 524288) throw new Error('Choisissez une capture PNG de 512 Kio maximum.');
        capture = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Lecture impossible.')); reader.onerror = () => reject(new Error('Lecture impossible.')); reader.readAsDataURL(file); });
      }
      const response = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, subject: values.get('subject'), category: values.get('category'), message: values.get('message'), website: values.get('website'), capture }), signal: AbortSignal.timeout(55000) });
      const result = await response.json() as { error?: string; message?: string; id?: string };
      if (!response.ok) throw new Error(result.error || 'Envoi impossible.');
      setSent(true); setStatus(`${result.message ?? 'Demande reçue.'}${result.id ? ` Référence : ${result.id}` : ''}`);
    } catch (e) { setStatus(e instanceof Error && e.name !== 'TimeoutError' && e.name !== 'TypeError' ? e.message : 'Connexion interrompue. L’enregistrement est incertain : vérifiez votre boîte e-mail avant de réessayer.'); }
    finally { setBusy(false); }
  }
  const field = 'block w-full rounded border border-slate-600 p-2';
  return <form onSubmit={submit} className="space-y-4">
    <p>Ne transmettez aucun mot de passe, numéro de carte ou secret. Masquez les données sensibles dans votre capture.</p>
    <fieldset disabled={busy || sent} className="space-y-4">
      <label className="block" htmlFor={`${id}-email`}>Votre e-mail<input id={`${id}-email`} className={field} name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => { emailEdited.current = true; setEmail(e.target.value); }} /></label>
      <label className="block" htmlFor={`${id}-subject`}>Sujet<input ref={subjectRef} id={`${id}-subject`} className={field} name="subject" required minLength={3} maxLength={160} defaultValue={question.slice(0, 160)} /></label>
      <label className="block" htmlFor={`${id}-category`}>Catégorie<select id={`${id}-category`} className={field} name="category" defaultValue={initialCategory}>{themes.map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="block" htmlFor={`${id}-message`}>Message<textarea id={`${id}-message`} className={field} name="message" required minLength={10} maxLength={5000} rows={6} defaultValue={question ? `Ma question : ${question}\n\nPrécisions : ` : ''} /></label>
      <label className="block" htmlFor={`${id}-capture`}>Capture facultative, PNG, 512 Kio maximum<input id={`${id}-capture`} className={field} name="capture" type="file" accept="image/png" /></label>
      <div hidden aria-hidden="true"><label htmlFor={`${id}-website`}>Laisser ce champ vide</label><input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></div>
      <button type="submit" className="rounded bg-slate-950 px-4 py-3 text-white disabled:opacity-60">{busy ? 'Envoi…' : 'Envoyer la demande'}</button>
    </fieldset><p role="status" aria-live="polite">{status}</p>
  </form>;
}
