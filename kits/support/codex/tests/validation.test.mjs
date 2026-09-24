import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate, escapeHTML, rateLimited } from '../api/support/validation.ts';
const valid = () => ({ email: ' Client@exemple.fr ', subject: 'Question', category: 'Compte', message: 'Voici une question complète.', website: '', capture: '' });
test('normalise l’adresse et conserve les champs valides', () => assert.equal(validate(valid()).email, 'client@exemple.fr'));
test('rejette les valeurs non structurées', () => { for (const v of [null, [], 1, 'test']) assert.throws(() => validate(v)); });
test('rejette champs absents, inconnus et mauvais types', () => { assert.throws(() => validate({ ...valid(), extra: 'x' })); assert.throws(() => validate({ ...valid(), message: 12 })); const v=valid(); delete v.capture; assert.throws(() => validate(v)); });
test('contrôle format et longueur des adresses', () => { for (const email of ['x', 'a@b', 'a@-b.fr', 'a\r\n@b.fr', 'a b@c.fr', `${'a'.repeat(250)}@b.fr`]) assert.throws(() => validate({ ...valid(), email })); });
test('contrôle les bornes du sujet et du message', () => {
 for (const [field, min, max] of [['subject',3,160],['message',10,5000]]) {
  for (const n of [min,max]) assert.doesNotThrow(() => validate({ ...valid(), [field]: 'x'.repeat(n) }));
  for (const n of [min-1,max+1]) assert.throws(() => validate({ ...valid(), [field]: 'x'.repeat(n) }));
 }
});
test('rejette catégorie arbitraire et caractères de contrôle', () => { assert.throws(() => validate({ ...valid(), category: 'Autre' })); assert.throws(() => validate({ ...valid(), subject: 'Test\r\nInjection' })); assert.throws(() => validate({ ...valid(), message: 'Message avec \0 secret' })); });
test('le champ piège est disponible pour un abandon sans insertion', () => assert.equal(validate({ ...valid(), website: 'robot' }).website, 'robot'));
test('capture PNG valide ou absente', () => { const capture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX2kAAAAASUVORK5CYII='; assert.doesNotThrow(() => validate({ ...valid(), capture })); assert.doesNotThrow(() => validate(valid())); });
test('rejette capture falsifiée, autre type et fichier trop gros', () => { for (const capture of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,aGVsbG8=', 'data:image/png;base64,'+'A'.repeat(700000)]) assert.throws(() => validate({ ...valid(), capture })); });
test('échappe les cinq caractères HTML dangereux', () => assert.equal(escapeHTML(`<img a="x">&'`), '&lt;img a=&quot;x&quot;&gt;&amp;&#39;'));
test('seuil de débit : cinq insertions autorisées, sixième refusée', () => { for(let n=0;n<5;n++) assert.equal(rateLimited(n),false); for(const n of [5,6,100]) assert.equal(rateLimited(n),true); });
test('le SQL de production utilise le même seuil sous verrou', () => { const sql=readFileSync(new URL('../sql/support_tickets.sql',import.meta.url),'utf8'); assert.match(sql,/recent_count >= 5/); assert.match(sql,/pg_advisory_xact_lock/); assert.match(sql,/created_at > clock_timestamp\(\) - interval '1 hour'/); assert.ok(sql.indexOf('pg_advisory_xact_lock') < sql.indexOf('select count(*)')); });
test('FAQ : soixante réponses, dix par thème, identifiants uniques', () => { const faq=JSON.parse(readFileSync(new URL('../data/faq.json',import.meta.url),'utf8')); assert.equal(faq.length,60); assert.equal(new Set(faq.map(f=>f.id)).size,60); const counts={}; for(const f of faq) { counts[f.category]=(counts[f.category]??0)+1; assert.ok(f.answer.length>100); } assert.deepEqual(Object.values(counts),[10,10,10,10,10,10]); });
