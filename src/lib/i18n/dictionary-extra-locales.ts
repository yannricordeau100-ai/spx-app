/**
 * Traductions complémentaires DE / NL / SV / DA pour les clés les plus visibles.
 *
 * Stratégie : translate() merge ces entries dans DICTIONARY au runtime via
 * `applyExtraLocales()`. Les clés non présentes ici fallback sur EN.
 *
 * Couverture actuelle : top ~50 clés (home, nav, auth, footer, search, contact,
 * referral, maintenance, KPIs essentiels). Le reste sera traduit progressivement.
 *
 * Règles d'écriture :
 *   - Acronymes financiers (KPI, EPS, FCF, TTM, ARPP, CAGR, IPO, ARR, etc.)
 *     restent inchangés dans toutes les langues — comme c'est déjà le cas en FR.
 *   - Le ton "investisseur clair" est préservé : pas de jargon inutile.
 *   - Variantes mineures (en-GB ↔ en, de-CH ↔ de) sont gérées par fallback
 *     automatique du translate() : pas besoin de les dupliquer.
 */

type LocaleKey = "de" | "nl" | "sv" | "da";

export const EXTRA_LOCALES: Record<string, Partial<Record<LocaleKey, string>>> = {
  // ───────────────────────── BRAND ─────────────────────────
  "brand.subtitle": {
    de: "KPI Intelligence",
    nl: "KPI Intelligence",
    sv: "KPI Intelligence",
    da: "KPI Intelligence",
  },
  "brand.tagline_main_1": {
    de: "Die Zahlen, die",
    nl: "De cijfers die",
    sv: "Siffrorna som",
    da: "Tallene der",
  },
  "brand.tagline_main_2": {
    de: "die Geschichte erzählen.",
    nl: "het verhaal vertellen.",
    sv: "berättar historien.",
    da: "fortæller historien.",
  },
  "brand.tagline_sub": {
    de: "3 Klicks zu den wichtigsten KPIs und exklusiven Super KPIs der größten US- und europäischen Unternehmen.",
    nl: "3 klikken naar de belangrijkste KPI's en exclusieve Super KPI's van de grootste Amerikaanse en Europese bedrijven.",
    sv: "3 klick till nyckel-KPI:er och exklusiva Super KPI:er från de största amerikanska och europeiska företagen.",
    da: "3 klik til de vigtigste KPI'er og eksklusive Super KPI'er fra de største amerikanske og europæiske virksomheder.",
  },
  "brand.data_updated": {
    de: "Daten aktualisiert am",
    nl: "Gegevens bijgewerkt op",
    sv: "Data uppdaterad den",
    da: "Data opdateret den",
  },
  "brand.companies_available": {
    de: "Verfügbare Unternehmen",
    nl: "Beschikbare bedrijven",
    sv: "Tillgängliga företag",
    da: "Tilgængelige virksomheder",
  },

  // ───────────────────────── AUTH ─────────────────────────
  "auth.signin.title": { de: "Anmelden", nl: "Inloggen", sv: "Logga in", da: "Log ind" },
  "auth.signup.title": { de: "Konto erstellen", nl: "Account aanmaken", sv: "Skapa konto", da: "Opret konto" },
  "auth.reset.title": { de: "Passwort vergessen", nl: "Wachtwoord vergeten", sv: "Glömt lösenord", da: "Glemt adgangskode" },
  "auth.cta.signin": { de: "Anmelden", nl: "Inloggen", sv: "Logga in", da: "Log ind" },
  "auth.cta.signup": { de: "Konto erstellen", nl: "Account aanmaken", sv: "Skapa konto", da: "Opret konto" },
  "auth.cta.google": { de: "Mit Google fortfahren", nl: "Doorgaan met Google", sv: "Fortsätt med Google", da: "Fortsæt med Google" },
  "auth.field.password": { de: "Passwort", nl: "Wachtwoord", sv: "Lösenord", da: "Adgangskode" },
  "auth.tab.signin": { de: "Anmelden", nl: "Inloggen", sv: "Logga in", da: "Log ind" },
  "auth.tab.signup": { de: "Registrieren", nl: "Registreren", sv: "Registrera", da: "Registrér" },
  "auth.divider.or": { de: "oder", nl: "of", sv: "eller", da: "eller" },
  "auth.divider.magic_link": { de: "Magic Link", nl: "Magic Link", sv: "Magic Link", da: "Magic Link" },
  "auth.forgot_password": { de: "Passwort vergessen?", nl: "Wachtwoord vergeten?", sv: "Glömt lösenord?", da: "Glemt adgangskode?" },
  "auth.has_account": { de: "Schon registriert?", nl: "Al een account?", sv: "Har du redan ett konto?", da: "Har du allerede en konto?" },
  "auth.no_account": { de: "Noch kein Konto?", nl: "Nog geen account?", sv: "Inget konto än?", da: "Ingen konto endnu?" },
  "authnav.signin": { de: "Anmelden", nl: "Inloggen", sv: "Logga in", da: "Log ind" },
  "authnav.signup": { de: "Registrieren", nl: "Registreren", sv: "Registrera", da: "Registrér" },
  "authnav.account": { de: "Mein Konto", nl: "Mijn account", sv: "Mitt konto", da: "Min konto" },

  // ───────────────────────── SEARCH ─────────────────────────
  "search.placeholder_hero": {
    de: "Apple, LVMH, SAP suchen…",
    nl: "Zoek Apple, LVMH, SAP…",
    sv: "Sök Apple, LVMH, SAP…",
    da: "Søg Apple, LVMH, SAP…",
  },
  "search.placeholder_compact": {
    de: "Unternehmen suchen…",
    nl: "Bedrijf zoeken…",
    sv: "Sök ett företag…",
    da: "Søg en virksomhed…",
  },
  "search.close": { de: "Schließen", nl: "Sluiten", sv: "Stäng", da: "Luk" },

  // ───────────────────── COMPANY PAGE ─────────────────────
  "company.kpi_principal": { de: "Haupt-KPI", nl: "Hoofd-KPI", sv: "Huvud-KPI", da: "Hoved-KPI" },
  "company.up_to_date": { de: "Aktuell", nl: "Actueel", sv: "Aktuell", da: "Opdateret" },
  "company.recent": { de: "Aktuell", nl: "Recent", sv: "Nyligen", da: "Nyligt" },
  "company.stale": { de: "Veraltete Daten", nl: "Verouderde gegevens", sv: "Föråldrade data", da: "Forældede data" },
  "company.next_results": { de: "Nächste Ergebnisse", nl: "Volgende resultaten", sv: "Nästa resultat", da: "Næste resultater" },
  "company.last_data": { de: "Letzter Datenpunkt", nl: "Laatste gegevens", sv: "Senaste datapunkt", da: "Seneste datapunkt" },
  "company.rank_world": { de: "Weltrang", nl: "Wereldwijde rang", sv: "Globalt rang", da: "Global rangering" },
  "company.rank_us": { de: "US-Rang", nl: "VS-rang", sv: "USA-rang", da: "USA-rang" },
  "company.sector": { de: "Sektor", nl: "Sector", sv: "Sektor", da: "Sektor" },
  "company.subsector": { de: "Unter-Sektor", nl: "Subsector", sv: "Undersektor", da: "Undersektor" },
  "company.founded": { de: "Gegründet", nl: "Opgericht in", sv: "Grundad", da: "Grundlagt" },
  "company.ipo": { de: "IPO", nl: "IPO", sv: "IPO", da: "IPO" },
  "company.chart.curve": { de: "Kurve", nl: "Curve", sv: "Kurva", da: "Kurve" },
  "company.chart.bars": { de: "Balken", nl: "Staven", sv: "Staplar", da: "Søjler" },
  "company.chart.variation": { de: "Veränderung", nl: "Variatie", sv: "Variation", da: "Variation" },
  "company.chart.dashboard": { de: "Dashboard", nl: "Dashboard", sv: "Dashboard", da: "Dashboard" },
  "company.save.button": { de: "Speichern", nl: "Opslaan", sv: "Spara", da: "Gem" },

  // ───────────────────────── NAV ─────────────────────────
  "nav.home": { de: "Startseite", nl: "Home", sv: "Hem", da: "Hjem" },

  // ──────────────────── REFERRAL ────────────────────
  "referral.title": { de: "Einen Freund einladen", nl: "Een vriend uitnodigen", sv: "Bjud in en vän", da: "Inviter en ven" },
  "referral.subtitle": {
    de: "Sie werben. Ihr Freund abonniert. Sie erhalten beide 1 Monat Premium kostenlos.",
    nl: "U werft. Uw vriend abonneert. U krijgt allebei 1 maand Premium gratis.",
    sv: "Du värvar. Din vän abonnerar. Ni får båda 1 månad Premium gratis.",
    da: "Du henviser. Din ven abonnerer. I får begge 1 måned Premium gratis.",
  },
  "referral.cta_generate": {
    de: "Meinen Einladungscode generieren",
    nl: "Mijn uitnodigingscode genereren",
    sv: "Generera min inbjudningskod",
    da: "Generér min invitationskode",
  },
  "referral.cta_copy": { de: "Link kopieren", nl: "Link kopiëren", sv: "Kopiera länk", da: "Kopiér link" },
  "referral.cta_copied": { de: "Link kopiert ✓", nl: "Link gekopieerd ✓", sv: "Länk kopierad ✓", da: "Link kopieret ✓" },
  "referral.your_code": { de: "Ihr Code", nl: "Uw code", sv: "Din kod", da: "Din kode" },
  "referral.your_link": { de: "Ihr Link zum Teilen", nl: "Uw link om te delen", sv: "Din länk att dela", da: "Dit link at dele" },
  "referral.signin_required": {
    de: "Melden Sie sich an, um Ihren Einladungscode zu generieren.",
    nl: "Log in om uw uitnodigingscode te genereren.",
    sv: "Logga in för att generera din inbjudningskod.",
    da: "Log ind for at generere din invitationskode.",
  },
  "referral.history_title": { de: "Ihre Einladungen", nl: "Uw uitnodigingen", sv: "Dina inbjudningar", da: "Dine invitationer" },
  "referral.history_empty": {
    de: "Noch keine Einladungen.",
    nl: "Nog geen uitnodigingen.",
    sv: "Inga inbjudningar än.",
    da: "Ingen invitationer endnu.",
  },
  "referral.how_it_works": { de: "So funktioniert es", nl: "Hoe het werkt", sv: "Så fungerar det", da: "Sådan fungerer det" },

  // ──────────────────── MAINTENANCE ────────────────────
  "maintenance.headline": {
    de: "Wir polieren ein paar Dinge",
    nl: "We poetsen een paar dingen op",
    sv: "Vi polerar några saker",
    da: "Vi pudser et par ting af",
  },
  "maintenance.subhead": {
    de: "Mettrik AI bekommt ein wichtiges Update. Wir sind sehr bald wieder da, versprochen.",
    nl: "Mettrik AI krijgt een belangrijke update. We zijn snel terug, beloofd.",
    sv: "Mettrik AI får en viktig uppdatering. Vi är tillbaka snart, lovar.",
    da: "Mettrik AI får en vigtig opdatering. Vi er snart tilbage, det lover vi.",
  },
  "maintenance.notify_label": {
    de: "Benachrichtigen Sie mich, wenn es zurück ist",
    nl: "Laat het me weten wanneer het terug is",
    sv: "Meddela mig när det är tillbaka",
    da: "Giv mig besked, når det er tilbage",
  },
  "maintenance.notify_submit": { de: "Benachrichtigen", nl: "Meld me", sv: "Meddela mig", da: "Giv besked" },
  "maintenance.eta_default": {
    de: "sehr bald ;)",
    nl: "heel snel ;)",
    sv: "mycket snart ;)",
    da: "meget snart ;)",
  },

  // ──────────────────── CONTACT ────────────────────
  "contact.title": { de: "Eine Frage? Wir antworten.", nl: "Een vraag? Wij antwoorden.", sv: "En fråga? Vi svarar.", da: "Et spørgsmål? Vi svarer." },
  "contact.subtitle": {
    de: "Sie sprechen mit Menschen, nicht mit Bots. Eine Antwort innerhalb von 48 Werktagen.",
    nl: "U spreekt met mensen, geen bots. Eén antwoord binnen 48 werkuren.",
    sv: "Du pratar med människor, inte bots. Ett svar inom 48 arbetstimmar.",
    da: "Du taler med mennesker, ikke bots. Et svar inden for 48 arbejdstimer.",
  },
  "contact.recipient_label": { de: "Anfragetyp", nl: "Type aanvraag", sv: "Förfrågningstyp", da: "Henvendelsestype" },
  "contact.recipient_contact": {
    de: "Allgemeiner Kontakt (Vertrieb, Presse, Partnerschaft)",
    nl: "Algemeen contact (verkoop, pers, partnerschap)",
    sv: "Allmän kontakt (försäljning, press, partnerskap)",
    da: "Generel kontakt (salg, presse, partnerskab)",
  },
  "contact.recipient_support": {
    de: "Technischer Support (Fehler, Kontoproblem)",
    nl: "Technische ondersteuning (bug, accountprobleem)",
    sv: "Teknisk support (bugg, kontoproblem)",
    da: "Teknisk support (fejl, kontoproblem)",
  },
  "contact.name_label": { de: "Ihr Name", nl: "Uw naam", sv: "Ditt namn", da: "Dit navn" },
  "contact.email_label": { de: "Ihre E-Mail", nl: "Uw e-mail", sv: "Din e-post", da: "Din e-mail" },
  "contact.subject_label": { de: "Betreff", nl: "Onderwerp", sv: "Ämne", da: "Emne" },
  "contact.body_label": { de: "Ihre Nachricht", nl: "Uw bericht", sv: "Ditt meddelande", da: "Din besked" },
  "contact.submit": { de: "Senden", nl: "Verzenden", sv: "Skicka", da: "Send" },
  "contact.sending": { de: "Wird gesendet…", nl: "Verzenden…", sv: "Skickar…", da: "Sender…" },
  "contact.success_title": { de: "Nachricht erhalten ✓", nl: "Bericht ontvangen ✓", sv: "Meddelande mottaget ✓", da: "Besked modtaget ✓" },

  // ──────────────────── TIME FRACTION ────────────────────
  "timefrac.label": {
    de: "Wert anzeigen pro:",
    nl: "Waarde tonen per:",
    sv: "Visa värde per:",
    da: "Vis værdi pr:",
  },
  "timefrac.year": { de: "Jahr", nl: "jaar", sv: "år", da: "år" },
  "timefrac.month": { de: "Monat", nl: "maand", sv: "månad", da: "måned" },
  "timefrac.week": { de: "Woche", nl: "week", sv: "vecka", da: "uge" },
  "timefrac.day": { de: "Tag", nl: "dag", sv: "dag", da: "dag" },
  "timefrac.hour": { de: "Stunde", nl: "uur", sv: "timme", da: "time" },
  "timefrac.minute": { de: "Minute", nl: "minuut", sv: "minut", da: "minut" },
  "timefrac.second": { de: "Sekunde", nl: "seconde", sv: "sekund", da: "sekund" },

  // ──────────────────── TTM TOOLTIP ────────────────────
  "ttm.label": { de: "TTM", nl: "TTM", sv: "TTM", da: "TTM" },
  "ttm.tooltip_title": {
    de: "Was ist TTM?",
    nl: "Wat is TTM?",
    sv: "Vad är TTM?",
    da: "Hvad er TTM?",
  },
};

/** Merge les EXTRA_LOCALES dans une entry du DICTIONARY. */
export function applyExtraLocale(key: string, base: { fr: string; en: string }): Record<string, string> {
  const extra = EXTRA_LOCALES[key];
  if (!extra) return base as Record<string, string>;
  return { ...base, ...extra };
}
