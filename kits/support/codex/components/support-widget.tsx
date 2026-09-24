'use client';
import { useRef, useState, type ComponentType } from 'react';
export default function SupportWidget() {
  const [Panel, setPanel] = useState<ComponentType<{ onClose: () => void }> | null>(null);
  const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const button = useRef<HTMLButtonElement>(null);
  async function launch() {
    setLoading(true); setError('');
    try { if (!Panel) { const module = await import('./support-faq'); setPanel(() => module.default); } setOpen(true); }
    catch { setError('Chargement impossible. Réessayez.'); } finally { setLoading(false); }
  }
  return <div className="fixed bottom-4 right-4 z-50 text-sm text-slate-950">
    <button ref={button} type="button" aria-haspopup="dialog" aria-expanded={open} disabled={loading} onClick={launch} className="rounded-lg bg-slate-950 px-5 py-3 text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">{loading ? 'Chargement…' : 'Aide et contact'}</button>
    <p role="status" className="bg-white text-red-800">{error}</p>
    {open && Panel && <Panel onClose={() => { setOpen(false); button.current?.focus(); }} />}
  </div>;
}
