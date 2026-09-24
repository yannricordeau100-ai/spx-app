export const categories = ['Compte', 'Abonnement et paiement', 'Données et KPI', 'Fiches sociétés', 'Confidentialité', 'Problème technique'] as const;
export type Category = typeof categories[number];
export type Ticket = { email: string; subject: string; category: Category; message: string; website: string; capture: string };
export const emailOK = (value: string): boolean => value.length <= 254 && /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i.test(value);
export function validate(value: unknown): Ticket {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Demande invalide.');
  const v = value as Record<string, unknown>;
  const keys = ['email', 'subject', 'category', 'message', 'website', 'capture'];
  if (Object.keys(v).some(k => !keys.includes(k)) || keys.some(k => typeof v[k] !== 'string')) throw new Error('Champs invalides.');
  const email = (v.email as string).trim().toLowerCase();
  const subject = (v.subject as string).trim();
  const message = (v.message as string).trim();
  if (!emailOK(email) || subject.length < 3 || subject.length > 160 || message.length < 10 || message.length > 5000 || !categories.includes(v.category as Category) || (v.website as string).length > 200 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(subject + message) || /[\r\n]/.test(subject)) throw new Error('Vérifiez l’adresse, le sujet (3 à 160 caractères) et le message (10 à 5 000 caractères).');
  const capture = v.capture as string;
  // PNG uniquement, 512 Kio maximum après décodage. Jamais rendu comme HTML.
  if (capture) {
    if (capture.length > 699074 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(capture)) throw new Error('La capture doit être une image PNG de 512 Kio maximum.');
    const bytes = Buffer.from(capture.slice(22), 'base64');
    if (bytes.length > 524288 || bytes.length < 24 || bytes.toString('base64') !== capture.slice(22) || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.subarray(12, 16).toString() !== 'IHDR') throw new Error('Capture PNG invalide.');
  }
  return { email, subject, message, category: v.category as Category, website: v.website as string, capture };
}
export function escapeHTML(text: string): string {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
export function rateLimited(count: number): boolean { return count >= 5; }
