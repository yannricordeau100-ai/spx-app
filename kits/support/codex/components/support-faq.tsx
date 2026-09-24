'use client';
import { useEffect, useId, useRef, useState } from 'react';
import faq from '../data/faq.json';
import SupportTicketForm from './support-ticket-form';
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export default function SupportFAQ({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const id = useId();
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('Tous les thèmes');
  const [ticket, setTicket] = useState<{ question: string; category: string } | null>(null);
  useEffect(() => { const d = dialog.current; d?.showModal(); return () => { d?.close(); }; }, []);
  const results = faq.filter(item => (category === 'Tous les thèmes' || item.category === category) && normalize(`${item.question} ${item.answer}`).includes(normalize(query.trim())));
  return <dialog ref={dialog} aria-labelledby={`${id}-title`} onCancel={onClose} className="fixed inset-0 m-auto max-h-[90dvh] w-[min(42rem,94vw)] overflow-y-auto rounded-xl bg-white p-6 text-slate-950 shadow-xl backdrop:bg-black/50">
    <div className="flex items-center justify-between gap-4"><h2 id={`${id}-title`} className="text-xl font-bold">Assistance Mettrik</h2><button type="button" onClick={onClose} className="rounded border border-slate-600 px-3 py-2">Fermer</button></div>
    {ticket ? <><button type="button" onClick={() => setTicket(null)} className="my-4 underline">Retour aux questions</button><SupportTicketForm question={ticket.question} initialCategory={ticket.category} /></> : <>
      <label className="mt-4 block" htmlFor={`${id}-search`}>Rechercher dans l’aide</label><input autoFocus id={`${id}-search`} value={query} onChange={e => setQuery(e.target.value)} type="search" maxLength={200} className="w-full rounded border border-slate-600 p-2" />
      <label className="mt-3 block" htmlFor={`${id}-theme`}>Thème</label><select id={`${id}-theme`} value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded border border-slate-600 p-2">{['Tous les thèmes', ...new Set(faq.map(f => f.category))].map(c => <option key={c}>{c}</option>)}</select>
      <p role="status" className="my-3">{results.length} réponse(s)</p>
      {results.map(item => <details key={item.id} className="border-b border-slate-300 py-3"><summary className="cursor-pointer font-semibold">{item.question}</summary><p className="my-3 leading-relaxed">{item.answer}</p><button type="button" className="text-blue-800 underline" onClick={() => setTicket({ question: item.question, category: item.category })}>Ça ne répond pas à ma question</button></details>)}
      {results.length === 0 && <p>Aucune réponse trouvée. Vous pouvez envoyer votre question au support.</p>}
      <button type="button" className="mt-5 rounded bg-slate-950 px-4 py-3 text-white" onClick={() => setTicket({ question: query, category: category === 'Tous les thèmes' ? 'Compte' : category })}>Contacter le support</button>
    </>}
  </dialog>;
}
