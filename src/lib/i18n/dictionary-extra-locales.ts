/**
 * Traductions complémentaires DE / NL / SV / DA pour TOUTES les clés du DICTIONARY.
 *
 * Stratégie : translate() merge ces entries dans DICTIONARY au runtime.
 * Si une clé n'est pas présente ici pour une locale, fallback EN puis FR.
 *
 * Couverture : 100% des clés du DICTIONARY (FR + EN sont les sources).
 *
 * Règles d'écriture :
 *   - Acronymes financiers (KPI, EPS, FCF, TTM, ARPP, CAGR, IPO, ARR, MRR,
 *     ROIC, ROE, EBITDA, P/E, GMV, MAU, DAU, ARPU, LTV, CAC, COGS, OPEX,
 *     CAPEX, SaaS, AI, ESG, GICS, TAM, TAC, ABF, CIA, IR, SEC, NYSE, NASDAQ,
 *     FED, CEO, CFO, S&P, ETF, AUM, FX) restent inchangés dans toutes les
 *     langues, comme c'est déjà le cas en FR.
 *   - "Mds" (FR) : DE = "Mrd", NL = "mld", SV = "mdr", DA = "mia.".
 *   - Symboles devise $ € £ et % préservés.
 *   - "Mettrik AI" inchangé.
 *   - Ton investisseur clair, professionnel.
 *   - Variantes mineures (en-GB ↔ en, de-CH ↔ de) sont gérées par fallback
 *     automatique du translate() : pas besoin de les dupliquer ici.
 */

type LocaleKey = "de" | "nl";

export const EXTRA_LOCALES: Record<string, Partial<Record<LocaleKey, string>>> = {
  // ───────────────────────── BRAND ─────────────────────────
  "brand.subtitle": {
    de: "KPI Intelligence",
    nl: "KPI Intelligence" },
  "brand.tagline_main_1": {
    de: "Die Zahlen, die",
    nl: "De cijfers die" },
  "brand.tagline_main_2": {
    de: "die Geschichte erzählen.",
    nl: "het verhaal vertellen." },
  // Yann (25 mai 2026) : tagline_sub retirée de l'UI. Vide pour back-compat.
  "brand.tagline_sub": {
    de: "",
    nl: "" },
  "brand.data_updated": {
    de: "Daten aktualisiert am",
    nl: "Gegevens bijgewerkt op" },
  "brand.companies_available": {
    de: "Verfügbare Unternehmen",
    nl: "Beschikbare bedrijven" },
  "brand.footer_tagline": {
    de: "Mettrik AI · KPI Intelligence für Investoren.",
    nl: "Mettrik AI · KPI Intelligence voor beleggers." },

  // ───────────────────────── AUTH ─────────────────────────
  "auth.signin.title": { de: "Anmelden", nl: "Inloggen" },
  "auth.signup.title": { de: "Konto erstellen", nl: "Account aanmaken" },
  "auth.reset.title": { de: "Passwort vergessen", nl: "Wachtwoord vergeten" },
  "auth.signin.subtitle": {
    de: "Greifen Sie auf die KPIs der größten US- und europäischen Unternehmen zu.",
    nl: "Krijg toegang tot de KPI's van de grootste Amerikaanse en Europese bedrijven." },
  "auth.signup.subtitle": {
    de: "Nur 3 Klicks bis zu den wichtigsten KPIs und privaten Super KPIs.",
    nl: "Slechts 3 klikken verwijderd van de essentiële KPI's en privé Super KPI's." },
  "auth.reset.subtitle": {
    de: "Geben Sie Ihre E-Mail ein, wir senden Ihnen einen Link zum Festlegen eines neuen Passworts.",
    nl: "Voer uw e-mail in, we sturen u een link om een nieuw wachtwoord te kiezen." },
  "auth.tab.signin": { de: "Anmelden", nl: "Inloggen" },
  "auth.tab.signup": { de: "Registrieren", nl: "Registreren" },
  "auth.cta.signin": { de: "Anmelden", nl: "Inloggen" },
  "auth.cta.signup": { de: "Konto erstellen", nl: "Mijn account aanmaken" },
  "auth.cta.google": { de: "Mit Google fortfahren", nl: "Doorgaan met Google" },
  "auth.cta.send_reset": { de: "Link senden", nl: "Link verzenden" },
  "auth.cta.send_magic": { de: "Senden", nl: "Verzenden" },
  "auth.field.email": { de: "sie@beispiel.com", nl: "u@voorbeeld.com" },
  "auth.field.password": { de: "Passwort", nl: "Wachtwoord" },
  "auth.field.password_min": {
    de: "Mindestens 8 Zeichen",
    nl: "Minimaal 8 tekens" },
  "auth.divider.or": { de: "oder", nl: "of" },
  "auth.divider.magic_link": { de: "Magic Link", nl: "Magic Link" },
  "auth.field.magic_email": {
    de: "Link per E-Mail erhalten",
    nl: "Een link per e-mail ontvangen" },
  "auth.forgot_password": { de: "Passwort vergessen?", nl: "Wachtwoord vergeten?" },
  "auth.no_account": { de: "Noch kein Konto?", nl: "Nog geen account?" },
  "auth.has_account": { de: "Schon registriert?", nl: "Al een account?" },
  "auth.create_account": { de: "Konto erstellen", nl: "Een account aanmaken" },
  "auth.back_to_signin": { de: "Zurück zur Anmeldung", nl: "Terug naar inloggen" },

  // ───────────────────────── AUTHNAV ─────────────────────────
  "authnav.signin": { de: "Anmelden", nl: "Inloggen" },
  "authnav.signup": { de: "Registrieren", nl: "Registreren" },
  "authnav.account": { de: "Mein Konto", nl: "Mijn account" },

  // ───────────────────────── SEARCH ─────────────────────────
  "search.placeholder_hero": {
    de: "Apple, LVMH, SAP suchen…",
    nl: "Zoek Apple, LVMH, SAP…" },
  "search.placeholder_compact": {
    de: "Unternehmen suchen…",
    nl: "Bedrijf zoeken…" },
  "search.results_count_one": { de: "Unternehmen", nl: "bedrijf" },
  "search.results_count_many": { de: "Unternehmen", nl: "bedrijven" },
  "search.results_for": { de: "für \"", nl: "voor \"" },
  "search.results_for_end": { de: "\"", nl: "\"" },
  "search.no_results": {
    de: "Kein Unternehmen gefunden für \"",
    nl: "Geen bedrijf gevonden voor \"" },
  "search.no_results_hint": {
    de: "Versuchen Sie einen Sektor (Finanzen, Industrie…) oder einen Ticker (GOOGL, META…).",
    nl: "Probeer een sector (Financiën, Industrie…) of een ticker (GOOGL, META…)." },
  "search.enter_to_open": { de: "↵ zum Öffnen", nl: "↵ om te openen" },
  "search.close": { de: "Schließen", nl: "Sluiten" },

  // ───────────────────── COMPANY PAGE ─────────────────────
  "company.kpi_principal": { de: "Haupt-KPI", nl: "Hoofd-KPI" },
  "company.up_to_date": { de: "Aktuell", nl: "Actueel" },
  "company.recent": { de: "Aktuell", nl: "Recent" },
  "company.stale": { de: "Veraltete Daten", nl: "Verouderde gegevens" },
  "company.unknown_date": { de: "Unbekanntes Datum", nl: "Onbekende datum" },
  "company.earning_pending": {
    de: "Earnings ausstehend",
    nl: "Earnings in afwachting" },
  "company.earning_pending_explainer": {
    de: "Das erwartete Earnings-Datum ist überschritten, aber die neuen Zahlen sind noch nicht in der Grafik integriert. Automatische Aktualisierung, sobald das 10-Q/10-K verfügbar ist.",
    nl: "De verwachte resultatendatum is verstreken, maar de nieuwe cijfers zijn nog niet in de grafiek opgenomen. Automatische update zodra de 10-Q/10-K beschikbaar is." },
  "company.earning_published": {
    de: "Ergebnisse veröffentlicht",
    nl: "Resultaten gepubliceerd" },
  "company.earning_published_explainer": {
    de: "Ergebnisse {quarter} am {date} veröffentlicht, Integration läuft.",
    nl: "Resultaten {quarter} gepubliceerd op {date}, integratie loopt." },
  "company.next_results": { de: "Nächste Ergebnisse", nl: "Volgende resultaten" },
  "company.last_quarter": { de: "Letztes abgedecktes Quartal", nl: "Laatste gedekte kwartaal" },
  "company.last_data": { de: "Letzter Datenpunkt", nl: "Laatste gegevens" },
  "company.fresh_explainer": {
    de: "Daten aktuell.",
    nl: "Gegevens actueel." },
  "company.recent_explainer": {
    de: "Letztes vollständiges Geschäftsjahr, weiterhin relevant.",
    nl: "Laatste volledige boekjaar, nog steeds relevant." },
  "company.stale_explainer": {
    de: "Ein neueres Geschäftsjahr wurde wahrscheinlich veröffentlicht.",
    nl: "Er is waarschijnlijk een recenter boekjaar gepubliceerd." },
  "company.unknown_explainer": {
    de: "Kein Datum mit diesem Datenpunkt verbunden.",
    nl: "Geen datum gekoppeld aan dit datapunt." },
  // Freshness tooltip (Yann 8 juin 2026 : refonte architecture "i") :
  "freshness.last_earning": {
    de: "Letztes Earning",
    nl: "Laatste earning" },
  "freshness.next_earning": {
    de: "Nächstes Earning",
    nl: "Volgende earning" },
  "freshness.published_on": {
    de: "veröffentlicht am",
    nl: "gepubliceerd op" },
  "freshness.published_around": {
    de: "veröffentlicht um",
    nl: "gepubliceerd rond" },
  "freshness.expected_on": {
    de: "erwartet am",
    nl: "verwacht op" },
  "freshness.expected_around": {
    de: "erwartet um",
    nl: "verwacht rond" },
  "company.rank_world": { de: "Weltrang", nl: "Wereldwijde rang" },
  "company.rank_us": { de: "US-Rang", nl: "VS-rang" },
  "company.sector": { de: "Sektor", nl: "Sector" },
  "company.subsector": { de: "Unter-Sektor", nl: "Subsector" },
  "company.founded": { de: "Gegründet", nl: "Opgericht in" },
  "company.ipo": { de: "IPO", nl: "IPO" },
  "company.employees": { de: "Mitarbeiter", nl: "Werknemers" },
  "company.also_known_as": {
    de: "Auch bekannt als:",
    nl: "Ook bekend als:",
  },
  "company.provenance": {
    de: "Alle gezeigten Zahlen stammen direkt oder indirekt vom Unternehmen. Drittdaten werden an der Stelle ihrer Erscheinung mit Quelle versehen.",
    nl: "Alle getoonde cijfers komen direct of indirect van het bedrijf. Gegevens van derden worden bij hun verschijning van bron voorzien." },
  "company.chart.curve": { de: "Kurve", nl: "Curve" },
  "company.chart.bars": { de: "Balken", nl: "Staven" },
  "company.chart.variation": { de: "Veränderung", nl: "Variatie" },
  "company.chart.dashboard": { de: "Dashboard", nl: "Dashboard" },
  "company.chart.curve.hint": { de: "Verlauf", nl: "Traject" },
  "company.chart.bars.hint": { de: "Jahr für Jahr", nl: "Jaar na jaar" },
  "company.chart.variation.hint": {
    de: "Jährliche Veränderung (year-over-year)",
    nl: "Jaarlijkse verandering (year-over-year)" },
  "company.chart.dashboard.hint": {
    de: "6 Indikatoren auf einen Blick",
    nl: "6 indicatoren in één oogopslag" },
  "company.period.5y": { de: "5 Jahre", nl: "5 jaar" },
  "company.period.10y": { de: "10 Jahre", nl: "10 jaar" },
  "company.period.20y": { de: "20 Jahre", nl: "20 jaar" },
  "company.period.locked": {
    de: "Verfügbar in V2",
    nl: "Beschikbaar in V2" },
  "graph.period.quarter": {
    de: "Quartalsweise",
    nl: "Per kwartaal" },
  "graph.period.year": {
    de: "Jährlich",
    nl: "Jaarlijks" },
  "graph.period.semester": {
    de: "Halbjährlich",
    nl: "Halfjaarlijks" },
  "graph.period.semester.tooltip": {
    de: "Halbjahresansicht (EU-Unternehmen berichten nur 2x/Jahr)",
    nl: "Halfjaarweergave (EU-bedrijven rapporteren slechts 2x/jaar)" },
  "graph.period.quarter.tooltip": {
    de: "Quartalsansicht (Standard)",
    nl: "Kwartaalweergave (standaard)" },
  "graph.period.year.tooltip": {
    de: "Jahresansicht (mit TTM-Balken)",
    nl: "Jaarweergave (met TTM-balk)" },
  "graph.period.quarter.unavailable": {
    de: "Quartalsdaten für diesen KPI nicht verfügbar",
    nl: "Kwartaaldata niet beschikbaar voor deze KPI" },
  "graph.bars.2d.tooltip": {
    de: "Klassischer flacher 2D-Stil",
    nl: "Klassieke platte 2D-stijl" },
  "graph.bars.3d.tooltip": {
    de: "Isometrischer 3D-Stil (Standard)",
    nl: "Isometrische 3D-stijl (standaard)" },
  "company.compare.button": { de: "Vergleichen", nl: "Vergelijken" },
  "company.compare.on": { de: "Vergleichen mit", nl: "Vergelijken met" },
  "company.compare.empty": {
    de: "Kein Unternehmen im Panel veröffentlicht einen vergleichbaren KPI zu",
    nl: "Geen bedrijf in het panel publiceert een KPI vergelijkbaar met" },
  "company.compare.direct": { de: "Direkt", nl: "Direct" },
  "company.compare.connex": { de: "Verwandt", nl: "Verwant" },
  "company.save.button": { de: "Speichern", nl: "Opslaan" },
  "company.kpi_table.show_more": { de: "Alle Indikatoren anzeigen", nl: "Toon alle indicatoren" },
  "company.kpi_table.show_less": { de: "Ausblenden", nl: "Verbergen" },
  "company.kpi_table.collapse": { de: "Reduzieren", nl: "Inklappen" },
  "company.kpi_table.see_more_one": {
    de: "1 weiteren Indikator anzeigen",
    nl: "1 extra indicator zien" },
  "company.kpi_table.see_more_many": {
    de: "{n} weitere Indikatoren anzeigen",
    nl: "{n} extra indicatoren zien" },

  // ───────────────────────── TIER ─────────────────────────
  "tier.excellent": { de: "Hervorragend", nl: "Uitstekend" },
  "tier.bon": { de: "Gut", nl: "Goed" },
  "tier.moyen": { de: "Mittel", nl: "Gemiddeld" },
  "tier.faible": { de: "Schwach", nl: "Zwak" },

  // ───────────────────────── STOCK ─────────────────────────
  "stock.market_cap": { de: "Marktkapitalisierung", nl: "Marktkapitalisatie" },

  // ───────────────────────── HERO ─────────────────────────
  "hero.cagr_5y": { de: "(CAGR 5 Jahre)", nl: "(CAGR 5 jaar)" },
  "hero.yoy": { de: "(YoY)", nl: "(YoY)" },
  "hero.percentile_top": { de: "Top", nl: "Top" },
  "kpi.active": { de: "Aktiv", nl: "Actief" },
  "kpi.definition": { de: "Definition", nl: "Definitie" },

  // ───────────────────────── STORIES ─────────────────────────
  "stories.aria_prev": { de: "Vorherige Story", nl: "Vorige story" },
  "stories.aria_next": { de: "Nächste Story", nl: "Volgende story" },
  "stories.aria_pause": { de: "Pause", nl: "Pauzeren" },
  "stories.aria_resume": { de: "Fortsetzen", nl: "Hervatten" },
  "stories.aria_jump": { de: "Zur Story springen", nl: "Naar story gaan" },
  "stories.title": { de: "Story", nl: "Story" },
  "stories.subtitle": {
    de: "Fokussierte KPIs (kurze oder einmalige Historie) und Marktpositionen. Mobile-Format: Auto-Play 5s pro Karte, Pfeile zum Navigieren, Hover zum Pausieren.",
    nl: "Gerichte KPI's (korte of eenmalige historie) en marktposities. Mobiel formaat: auto-play 5s per kaart, pijlen om te navigeren, hover om te pauzeren." },
  "stories.market_position": { de: "Markt · TAM", nl: "Markt · TAM" },
  "stories.cat.Marché": { de: "Markt", nl: "Markt" },
  "stories.cat.Innovation": { de: "Innovation", nl: "Innovatie" },
  "stories.cat.Adoption": { de: "Adoption", nl: "Adoptie" },
  "stories.cat.Capacité": { de: "Kapazität", nl: "Capaciteit" },
  "stories.cat.Story": { de: "Story", nl: "Story" },
  "stories.market_share": { de: "Marktanteil", nl: "marktaandeel" },
  "stories.segment_revenue": { de: "Segmentumsatz", nl: "Segmentomzet" },
  "stories.market_cagr": { de: "Erwarteter Markt-CAGR", nl: "Verwachte markt-CAGR" },
  "stories.source": { de: "Quelle", nl: "Bron" },

  // ───────────────────────── RISKS ─────────────────────────
  "risks.title": { de: "Risikofaktoren", nl: "Risicofactoren" },
  "risks.severity": { de: "Schweregrad", nl: "Ernst" },
  "risks.subtitle": {
    de: "Direkte Aussagen des Managements, bewertet nach 4 Kriterien. Klicken Sie für das vollständige Zitat; bewegen Sie den Mauszeiger über das \"i\"-Symbol, um die Bewertung zu verstehen.",
    nl: "Directe uitspraken van het management, beoordeeld op 4 criteria. Klik voor het volledige citaat; ga met de muis over het \"i\"-pictogram om de score te begrijpen." },
  "risks.count": { de: "Risiken", nl: "risico's" },
  "risks.aggravated_one": { de: "verschärft", nl: "verergerd" },
  "risks.aggravated_many": { de: "verschärft", nl: "verergerd" },
  "risks.new_one": { de: "neu in 2025", nl: "nieuw in 2025" },
  "risks.new_many": { de: "neu in 2025", nl: "nieuw in 2025" },
  "risks.management_quote": { de: "Aussage des Managements", nl: "Citaat van het management" },
  "risks.score_explainer_title": {
    de: "Wie diese Bewertung berechnet wurde",
    nl: "Hoe deze score is berekend" },
  "risks.score_scale_title": { de: "Skala", nl: "Schaal" },
  "risks.score_scale_1": {
    de: "Position im 10-K (offizielle Reihenfolge)",
    nl: "Positie in de 10-K (officiële volgorde)" },
  "risks.score_scale_2": {
    de: "Intensität der juristischen Sprache",
    nl: "Intensiteit van juridische taal" },
  "risks.score_scale_3": { de: "Trend vs. Vorjahres-10-K", nl: "Trend vs. 10-K vorig jaar" },
  "risks.score_scale_4": {
    de: "Kategoriegewicht (Cyber, Regulatorik hoch gewichtet)",
    nl: "Categoriegewicht (cyber, regelgeving hoog gewogen)" },
  "risks.category.regulatory": { de: "Regulatorisch", nl: "Regelgeving" },
  "risks.category.competitive": { de: "Wettbewerb", nl: "Concurrentie" },
  "risks.category.cyber": { de: "Cybersicherheit", nl: "Cyberveiligheid" },
  "risks.category.operational": { de: "Operativ", nl: "Operationeel" },
  "risks.category.financial": { de: "Finanziell", nl: "Financieel" },
  "risks.category.macro": { de: "Makro", nl: "Macro" },
  "risks.category.technology": { de: "Technologie", nl: "Technologie" },
  "risks.trend.new": { de: "Neu 2025", nl: "Nieuw 2025" },
  "risks.trend.up": { de: "Verschärft", nl: "Verergerd" },
  "risks.trend.stable": { de: "Stabil", nl: "Stabiel" },
  "risks.trend.down": { de: "Abgeschwächt", nl: "Afgenomen" },
  "risks.trend.removed": { de: "Entfernt", nl: "Verwijderd" },
  "risks.score.critical": { de: "Kritisch", nl: "Kritiek" },
  "risks.score.high": { de: "Hoch", nl: "Hoog" },
  "risks.score.moderate": { de: "Moderat", nl: "Matig" },
  "risks.score.low": { de: "Niedrig", nl: "Laag" },
  "risks.score.marginal": { de: "Marginal", nl: "Marginaal" },
  "risks.pw.label": { de: "Gewinnwarnung", nl: "Winstwaarschuwing" },
  "risks.pw.title_tooltip": {
    de: "Gewinnwarnung",
    nl: "Winstwaarschuwing" },
  "risks.pw.explainer": {
    de: "Öffentliche, vom Management vorgezogene Ankündigung, dass die kommenden Ergebnisse den Analystenkonsens deutlich verfehlen werden (Margenverlust, Marktumkehr, Sonderbelastung). Typische Auswirkung auf den Kurs: -10 bis -30 % innerhalb von Stunden.",
    nl: "Openbare aankondiging vooraf door het management dat de komende resultaten aanzienlijk onder de analistenconsensus zullen liggen (margeverlies, marktomslag, eenmalige last). Typische impact op de koers: -10 tot -30 % binnen enkele uren." },
  "risks.pw.note_label": { de: "Bewertung basiert auf:", nl: "Score gebaseerd op:" },
  "risks.pw.note_body": {
    de: "(1) Warnhistorie + Management-Kommentare + letzter Earnings Call; (2) kurz- bis mittelfristiger Trend (<3 Monate) der Margenkompression über frühere öffentliche Aussagen hinaus.",
    nl: "(1) waarschuwingsgeschiedenis + commentaar van het management + laatste earnings call; (2) korte- tot middellange-termijn trend (<3 maanden) van margedaling buiten eerdere publieke uitspraken." },
  "risks.pw.headline": {
    de: "Risiko einer Gewinnwarnung",
    nl: "Risico op winstwaarschuwing" },
  "risks.pw.last_date": { de: "Datum der letzten Gewinnwarnung:", nl: "Datum laatste winstwaarschuwing:" },
  "risks.pw.never": { de: "Nie", nl: "Nooit" },
  "risks.pw.margin_trend": { de: "Margentrend:", nl: "Margetrend:" },
  "risks.pw.score.very_unlikely": { de: "Sehr unwahrscheinlich", nl: "Zeer onwaarschijnlijk" },
  "risks.pw.score.unlikely": { de: "Unwahrscheinlich", nl: "Onwaarschijnlijk" },
  "risks.pw.score.moderate": { de: "Moderat", nl: "Matig" },
  "risks.pw.score.high": { de: "Hoch", nl: "Hoog" },
  "risks.pw.score.imminent": { de: "Unmittelbar bevorstehend", nl: "Op handen" },

  // ───────────────────── REPARTITION ─────────────────────
  "repartition.title": { de: "Umsatzaufteilung", nl: "Omzetverdeling" },
  "repartition.subtitle": {
    de: "Wechseln Sie zwischen geografischer Ansicht und operativer Segmentansicht. Wischen Sie seitlich (oder klicken Sie), um den Visualisierungsstil zu ändern.",
    nl: "Schakel tussen geografische weergave en operationele segmentweergave. Veeg horizontaal (of klik) om de visualisatiestijl te wijzigen." },
  "repartition.tab.geo": { de: "Geografisch", nl: "Geografisch" },
  "repartition.tab.segment": { de: "Segment", nl: "Segment" },
  "repartition.style.treemap": { de: "Treemap", nl: "Treemap" },
  "repartition.style.radial": { de: "Radial", nl: "Radiaal" },
  "repartition.style.iso": { de: "ISO 3D", nl: "ISO 3D" },
  "repartition.no_data": {
    de: "Daten für diese Dimension nicht verfügbar.",
    nl: "Gegevens niet beschikbaar voor deze dimensie." },
  "repartition.source": { de: "Quelle", nl: "Bron" },

  // ───────────────────── GOVERNANCE ─────────────────────
  "governance.title": { de: "Governance & Vergütung", nl: "Bestuur & beloning" },
  "governance.subtitle_prefix": { de: "Aktualisiert per Hauptversammlung am", nl: "Bijgewerkt tot AVA van" },
  "governance.subtitle_suffix": { de: "Zahlen für Geschäftsjahr", nl: "Cijfers voor boekjaar" },
  "governance.dual_class": { de: "Dual-Class", nl: "Dual-class" },
  "governance.mono_class": {
    de: "Mono-Class (1 Aktie = 1 Stimme)",
    nl: "Mono-class (1 aandeel = 1 stem)" },
  "governance.dual_class_tooltip": {
    de: "Dual-Class-Struktur: Aktien Class A / Class B mit unterschiedlichen Stimmrechten. Gründer / Manager behalten ein überproportionales Stimmgewicht trotz geringen Kapitalanteils. Signal langfristiger Kontrolle + Governance-Risiko.",
    nl: "Dual-class structuur: Class A / Class B aandelen met verschillende stemrechten. Oprichters / managers behouden onevenredig stemrecht ondanks klein aandeel in kapitaal. Signaal van langetermijncontrole + governancerisico." },
  "governance.mono_class_tooltip": {
    de: "Mono-Class-Struktur: 1 Aktie = 1 Stimme. Top-Voting und Top-Kapital fallen zusammen.",
    nl: "Mono-class structuur: 1 aandeel = 1 stem. Top voting en top capital vallen samen." },
  "governance.top_voting": { de: "Stimmrechte", nl: "Stemrechten" },
  "governance.top_capital": { de: "Kapitalanteil", nl: "Aandeel kapitaal" },
  "governance.view_3d": { de: "3D-Ansicht", nl: "3D-weergave" },
  "governance.voting_structure": { de: "Stimmstruktur", nl: "Stemstructuur" },
  "governance.notes": { de: "Bemerkenswert", nl: "Opmerkelijk" },
  "governance.pie_title.voting": {
    de: "Stimmrechtsinhaber",
    nl: "Houders van stemrechten" },
  "governance.pie_title.capital": {
    de: "Kapitalinhaber",
    nl: "Houders van kapitaal" },
  "governance.metrics.ceo_comp_label": {
    de: "Gesamtvergütung des CEO",
    nl: "Totale vergoeding van de CEO" },
  "governance.metrics.ceo_comp_tooltip": {
    de: "Gesamtvergütung = Gehalt + Jahresbonus + Stock Awards + Optionen + Vorteile, für das Geschäftsjahr",
    nl: "Totale comp = salaris + jaarbonus + stock awards + opties + voordelen, voor het boekjaar" },
  "governance.metrics.pay_ratio_label": {
    de: "Verhältnis CEO-Vergütung / Median-Mitarbeiter",
    nl: "Ratio CEO / mediaan werknemer" },
  "governance.metrics.pay_ratio_tooltip": {
    de: "Vielfaches zwischen CEO-Vergütung und Median-Mitarbeiterlohn. S&P 500 Median ≈ 200×.",
    nl: "Veelvoud tussen CEO-vergoeding en mediaan werknemersloon. S&P 500 mediaan ≈ 200×." },
  "governance.metrics.exec_approval_label": {
    de: "Vergütungsgenehmigung",
    nl: "Goedkeuring beloning" },
  "governance.metrics.exec_approval_tooltip": {
    de: "Jährliche beratende Aktionärsabstimmung über Vorstandsvergütung (say-on-pay). Unter 80 % = bemerkenswerter Widerspruch.",
    nl: "Jaarlijkse adviserende aandeelhoudersstemming over de beloning van bestuurders (say-on-pay). Onder 80 % = opvallende afwijzing." },
  "governance.metrics.board_independence_label": {
    de: "Board-Unabhängigkeit",
    nl: "Onafhankelijkheid van het bestuur" },
  "governance.metrics.board_independence_tooltip": {
    de: "Anteil unabhängiger Direktoren (keine Führungs-, Familien- oder Geschäftsbeziehungen). NYSE / Nasdaq verlangen eine Mehrheit.",
    nl: "Aandeel onafhankelijke bestuurders (geen leidinggevende, familiale of zakelijke banden). NYSE / Nasdaq vereisen een meerderheid." },
  "governance.metrics.board_size_label": { de: "Board-Größe", nl: "Grootte van het bestuur" },
  "governance.metrics.board_size_unit": { de: "Mitglieder", nl: "leden" },
  "governance.metrics.board_size_tooltip_title": {
    de: "Board-Mitglieder",
    nl: "Bestuursleden" },
  "governance.metrics.tenure_label": { de: "Durchschnittliche Amtszeit", nl: "Gemiddelde anciënniteit" },
  "governance.metrics.tenure_unit": { de: "Jahre", nl: "jaar" },
  "governance.metrics.tenure_tooltip": {
    de: "Durchschnittliche Direktoren-Amtszeit. Zu kurz = mangelnde Erfahrung; zu lang (>10 Jahre) = unzureichende Erneuerung.",
    nl: "Gemiddelde anciënniteit van bestuurders. Te kort = gebrek aan ervaring; te lang (>10 jaar) = onvoldoende vernieuwing." },
  "governance.metrics.women_label": { de: "Diversität: Frauen im Board", nl: "Diversiteit: vrouwen in bestuur" },
  "governance.metrics.women_tooltip": {
    de: "% Frauen im Board. S&P 500 Median ≈ 32 %. Einige institutionelle Investoren stimmen gegen Boards unter 30 %.",
    nl: "% vrouwen in het bestuur. S&P 500 mediaan ≈ 32 %. Sommige institutionele beleggers stemmen tegen besturen onder 30 %." },
  "governance.metrics.age_label": { de: "Durchschnittsalter des Boards", nl: "Gemiddelde leeftijd bestuur" },
  "governance.metrics.insider_label": {
    de: "Insider-Beteiligung (Management + Board)",
    nl: "Insider-bezit (directie + bestuur)" },
  "governance.metrics.insider_tooltip": {
    de: "Anteil des von Management und Board gehaltenen Kapitals. Hoch = starke Ausrichtung mit Aktionären.",
    nl: "Aandeel van het kapitaal in handen van directie en bestuur. Hoog = sterke afstemming met aandeelhouders." },
  "governance.peer.bas": { de: "Unter dem Durchschnitt", nl: "Onder het gemiddelde" },
  "governance.peer.moyen": { de: "Im Durchschnitt", nl: "Gemiddeld" },
  "governance.peer.haut": { de: "Über dem Durchschnitt", nl: "Boven het gemiddelde" },
  "governance.peer.extreme": { de: "Weit darüber", nl: "Ver erboven" },
  "governance.holder.fondateur": { de: "Gründer", nl: "Oprichter" },
  "governance.holder.insider": { de: "Insider", nl: "Insider" },
  "governance.holder.institutionnel": { de: "Institutionell", nl: "Institutioneel" },
  "governance.holder.particulier": { de: "Privatanleger", nl: "Particulier" },
  "governance.holder.fonds_souverain": { de: "Staatsfonds", nl: "Soeverein fonds" },

  // ───────────────────────── AI ─────────────────────────
  "ai.title_prefix": { de: "KI-Positionierung von", nl: "AI-positionering van" },
  "ai.title_suffix": { de: "", nl: "" },
  "ai.stance.leader.label": { de: "Hauptakteur", nl: "Belangrijke speler" },
  "ai.stance.leader.desc": {
    de: "AI ist Kern der Strategie und Produkte.",
    nl: "AI is kern van strategie en producten." },
  "ai.stance.integrator.label": { de: "Integrator", nl: "Integrator" },
  "ai.stance.integrator.desc": {
    de: "AI ist deutlich in den operativen Betrieb und das Produktangebot integriert.",
    nl: "AI is significant geïntegreerd in operaties en productaanbod." },
  "ai.stance.cautious.label": { de: "Vorsichtiger Beobachter", nl: "Voorzichtige waarnemer" },
  "ai.stance.cautious.desc": {
    de: "AI wird erwähnt, aber die Integration bleibt begrenzt oder im Aufbau.",
    nl: "AI wordt genoemd maar integratie blijft beperkt of opkomend." },
  "ai.stance.absent.label": { de: "Keine Positionierung", nl: "Geen positionering" },
  "ai.stance.absent.desc": {
    de: "Keine bedeutende Erwähnung von AI in offiziellen Mitteilungen.",
    nl: "Geen significante vermelding van AI in officiële communicatie." },
  "ai.absent_summary": {
    de: "hat keine ausdrückliche AI-Positionierung in seinen Pflichtmeldungen oder jüngsten Konferenzen kommuniziert. Wird neu bewertet, sobald eine Position formuliert wird.",
    nl: "heeft geen expliciete AI-positionering meegedeeld in zijn officiële deponeringen of recente conferenties. Wordt opnieuw bekeken zodra een positie is geformuleerd." },
  "ai.absent_source": { de: "Nicht offengelegt", nl: "Niet bekendgemaakt" },
  "ai.evidence_label": { de: "Konkrete Belege", nl: "Concrete bewijzen" },
  "ai.source": { de: "Quelle", nl: "Bron" },

  // ───────────────────────── SENATE ─────────────────────────
  "senate.title_prefix": { de: "US-Senate-Trades zu", nl: "Trades van de Amerikaanse Senaat over" },
  "senate.bullish": { de: "Bullish", nl: "Bullish" },
  "senate.bearish": { de: "Bearish", nl: "Bearish" },
  "senate.neutral": { de: "Neutral", nl: "Neutraal" },
  "senate.purchase": { de: "Kauf", nl: "Aankoop" },
  "senate.sale": { de: "Verkauf", nl: "Verkoop" },
  "senate.legal_delay": {
    de: "Gesetzliche Frist STOCK Act 2012: Senatoren haben 30 bis 45 Tage nach einer Transaktion Zeit, sie zu melden. Die angezeigten Transaktionen sind konstruktionsbedingt mindestens ~30 Tage alt.",
    nl: "Wettelijke termijn STOCK Act 2012: senatoren hebben 30 tot 45 dagen na een transactie om deze te melden. De getoonde transacties zijn per definitie ten minste ~30 dagen oud." },
  "senate.tooltip_body": {
    de: "Von US-Senatoren unter dem STOCK Act 2012 gemeldete Transaktionen (Pflichtmeldung innerhalb von 45 Tagen für Geschäfte > 1.000 $).",
    nl: "Transacties bekendgemaakt door Amerikaanse senatoren onder de STOCK Act 2012 (verplichte bekendmaking binnen 45 dagen voor elke handel > $1.000)." },
  "senate.tooltip_alpha": {
    de: "Historisches Investorensignal: Senatoren-Käufe auf einem Ticker gehen oft einer Aufwärtsbewegung voraus (~6-12 % Alpha gegenüber S&P über 12 Monate laut mehreren Studien).",
    nl: "Historisch beleggerssignaal: senatoriale aankopen op een ticker gaan vaak gepaard met een opwaartse beweging (~6-12 % alpha vs S&P over 12 maanden volgens meerdere studies)." },
  "senate.source_line": {
    de: "Quelle: Senate Stock Watcher / Capitol Trades.",
    nl: "Bron: Senate Stock Watcher / Capitol Trades." },
  "senate.subtitle": {
    de: "Breite jeder Karte = Größenordnung des Betrags. Randfarbe = Partei.",
    nl: "Breedte van elke kaart = orde van grootte van het bedrag. Randkleur = partij." },
  "senate.signal_label": { de: "Signal", nl: "Signaal" },
  "senate.bullish_explainer": {
    de: "Senatoren kaufen deutlich mehr als sie verkaufen.",
    nl: "Senatoren kopen aanzienlijk meer dan ze verkopen." },
  "senate.bearish_explainer": {
    de: "Senatoren verkaufen deutlich mehr als sie kaufen.",
    nl: "Senatoren verkopen aanzienlijk meer dan ze kopen." },
  "senate.neutral_explainer": { de: "Käufe und Verkäufe sind ausgeglichen.", nl: "Aankopen en verkopen zijn in evenwicht." },
  "senate.buy_one": { de: "Kauf", nl: "aankoop" },
  "senate.buy_many": { de: "Käufe", nl: "aankopen" },
  "senate.sell_one": { de: "Verkauf", nl: "verkoop" },
  "senate.sell_many": { de: "Verkäufe", nl: "verkopen" },
  "senate.tx_visible": { de: "sichtbare Transaktionen.", nl: "zichtbare transacties." },
  "senate.party.R": { de: "Republikaner", nl: "Republikein" },
  "senate.party.D": { de: "Demokrat", nl: "Democraat" },
  "senate.party.I": { de: "Unabhängig", nl: "Onafhankelijk" },
  "senate.relative.today": { de: "heute", nl: "vandaag" },
  "senate.relative.yesterday": { de: "gestern", nl: "gisteren" },
  "senate.relative.days_ago": { de: "vor {n} Tagen", nl: "{n} dagen geleden" },
  "senate.relative.month_ago": { de: "vor 1 Monat", nl: "1 maand geleden" },
  "senate.relative.months_ago": { de: "vor {n} Monaten", nl: "{n} maanden geleden" },
  "senate.relative.year_ago": { de: "vor 1 Jahr", nl: "1 jaar geleden" },
  "senate.relative.years_ago": { de: "vor {n} Jahren", nl: "{n} jaar geleden" },
  "senate.declared_within": { de: "gemeldet innerhalb {n} Tagen", nl: "gemeld binnen {n}d" },
  "senate.late_filing": { de: "verspätete Meldung", nl: "late filing" },
  "senate.demo_footer": {
    de: "Demo-Daten: Live-Anbindung an Senate Stock Watcher / Capitol Trades API in V1.5",
    nl: "Demo-gegevens: live-koppeling met Senate Stock Watcher / Capitol Trades API in V1.5" },

  // ──────────────────── MAINTENANCE ────────────────────
  "maintenance.headline": {
    de: "Wir machen uns schick.",
    nl: "We maken ons mooi." },
  "maintenance.subhead": {
    de: "Etwas Wertvolles für Investoren entsteht hier. Bis sehr bald.",
    nl: "Iets waardevols voor beleggers krijgt hier vorm. Tot snel." },
  "maintenance.fun_caption": {
    de: "Mettrik AI · KPI Intelligence",
    nl: "Mettrik AI · KPI Intelligence" },

  // ──────────────────── TTM ────────────────────
  "ttm.label": { de: "TTM", nl: "TTM" },
  "ttm.tooltip_title": {
    de: "Was ist TTM?",
    nl: "Wat is TTM?" },
  "ttm.tooltip_body": {
    de: "TTM bedeutet Trailing Twelve Months: die letzten 12 veröffentlichten Monate. Es ist die Summe der letzten 4 bekannten Quartale, unabhängig vom Kalenderjahresbeginn. Zeigt den aktuellsten Trend ohne auf den Jahresabschluss zu warten. Der TTM-Balken ist gestrichelt, um ihn von Kalenderjahren zu unterscheiden.",
    nl: "TTM betekent Trailing Twelve Months: de meest recente 12 gepubliceerde maanden. Het is de som van de laatste 4 bekende kwartalen, ongeacht wanneer het kalenderjaar begint. Toont de nieuwste trend zonder te wachten op de jaarafsluiting. De TTM-balk is gestippeld om hem te onderscheiden van kalenderjaren." },

  // ──────────────────── TIME FRACTION ────────────────────
  "timefrac.label": {
    de: "Wert anzeigen pro:",
    nl: "Waarde tonen per:" },
  "timefrac.year": { de: "Jahr", nl: "jaar" },
  "timefrac.month": { de: "Monat", nl: "maand" },
  "timefrac.week": { de: "Woche", nl: "week" },
  "timefrac.day": { de: "Tag", nl: "dag" },
  "timefrac.hour": { de: "Stunde", nl: "uur" },
  "timefrac.minute": { de: "Minute", nl: "minuut" },
  "timefrac.second": { de: "Sekunde", nl: "seconde" },
  "timefrac.tooltip": {
    de: "Zeigt den Wert geteilt durch Zeitanteil. Nützlich, um zu sehen \"wie viel verdient dieses Unternehmen pro Sekunde?\". Einfache Berechnung: Jahreswert ÷ Anzahl der Anteile in einem Jahr (365 Tage, 8 760 Stunden, etc.).",
    nl: "Toont de waarde gedeeld door tijdsfractie. Handig om te zien 'hoeveel verdient dit bedrijf per seconde?'. Eenvoudige berekening: jaarlijkse waarde ÷ aantal fracties in een jaar (365 dagen, 8.760 uur, enz.)." },

  // ──────────────────── REFERRAL ────────────────────
  "referral.title": { de: "Einen Freund einladen", nl: "Een vriend uitnodigen" },
  "referral.subtitle": {
    de: "Sie werben. Ihr Freund abonniert. Sie erhalten beide 1 Monat Premium kostenlos.",
    nl: "U werft. Uw vriend abonneert. U krijgt allebei 1 maand Premium gratis." },
  "referral.cta_generate": {
    de: "Meinen Einladungscode generieren",
    nl: "Mijn uitnodigingscode genereren" },
  "referral.cta_copy": { de: "Link kopieren", nl: "Link kopiëren" },
  "referral.cta_copied": { de: "Link kopiert ✓", nl: "Link gekopieerd ✓" },
  "referral.your_code": { de: "Ihr Code", nl: "Uw code" },
  "referral.your_link": { de: "Ihr Link zum Teilen", nl: "Uw link om te delen" },
  "referral.signin_required": {
    de: "Melden Sie sich an, um Ihren Einladungscode zu generieren.",
    nl: "Log in om uw uitnodigingscode te genereren." },
  "referral.paid_required": {
    de: "Die Einladung ist nur für aktive Premium-Abonnenten. Abonnieren Sie zuerst, um zu werben.",
    nl: "Verwijzing is alleen voor actieve Premium-abonnees. Abonneer eerst om te kunnen werven." },
  "referral.history_title": { de: "Ihre Einladungen", nl: "Uw uitnodigingen" },
  "referral.history_empty": {
    de: "Noch keine Einladungen.",
    nl: "Nog geen uitnodigingen." },
  "referral.status_pending": { de: "Ausstehend", nl: "In afwachting" },
  "referral.status_signed_up": { de: "Freund registriert", nl: "Vriend ingeschreven" },
  "referral.status_subscribed": { de: "Freund abonniert", nl: "Vriend geabonneerd" },
  "referral.status_rewarded": { de: "Belohnung gutgeschrieben", nl: "Beloning toegekend" },
  "referral.status_expired": { de: "Abgelaufen", nl: "Verlopen" },
  "referral.status_invalid": { de: "Ungültig", nl: "Ongeldig" },
  "referral.expires_in": { de: "Läuft ab am", nl: "Verloopt op" },
  "referral.how_it_works": { de: "So funktioniert es", nl: "Hoe het werkt" },
  "referral.step1": {
    de: "Registrieren Sie sich und abonnieren Sie einen Premium-Plan (monatlich oder jährlich).",
    nl: "Schrijf je in en abonneer je op een Premium-plan (maandelijks of jaarlijks)." },
  "referral.step2": {
    de: "Klicken Sie auf dieser Seite auf \"Code generieren\" und teilen Sie den erhaltenen Link mit einem Freund.",
    nl: "Klik op deze pagina op \"Mijn code genereren\" en deel de verkregen link met een vriend." },
  "referral.step3": {
    de: "Wenn Ihr Freund einen kostenpflichtigen Plan abonniert, erhalten Sie beide 1 Monat Premium kostenlos (egal welcher Plan gewählt wird).",
    nl: "Wanneer uw vriend zich abonneert op een betaald plan, krijgt u allebei 1 maand Premium gratis (ongeacht het gekozen plan)." },
  "referral.code_invalid": { de: "Ungültiger oder abgelaufener Einladungscode.", nl: "Ongeldige of verlopen uitnodigingscode." },
  "referral.code_valid_invited_by": { de: "Sie wurden eingeladen von", nl: "U bent uitgenodigd door" },
  "referral.disabled": {
    de: "Das Empfehlungsprogramm ist vorübergehend pausiert. Bald wieder verfügbar.",
    nl: "Het verwijzingsprogramma is tijdelijk opgeschort. Kom binnenkort terug." },

  // ──────────────────── CONTACT ────────────────────
  "contact.title": { de: "Eine Frage? Wir antworten.", nl: "Een vraag? Wij antwoorden." },
  "contact.subtitle": {
    de: "Sie sprechen mit Menschen, nicht mit Bots. Eine E-Mail, eine Antwort innerhalb von 48 Werktagen.",
    nl: "U spreekt met mensen, geen bots. Eén e-mail, één antwoord binnen 48 werkuren." },
  "contact.recipient_label": { de: "Anfragetyp", nl: "Type aanvraag" },
  "contact.recipient_contact": {
    de: "Allgemeiner Kontakt (Vertrieb, Presse, Partnerschaft)",
    nl: "Algemeen contact (verkoop, pers, partnerschap)" },
  "contact.recipient_support": {
    de: "Technischer Support (Fehler, Kontoproblem)",
    nl: "Technische ondersteuning (bug, accountprobleem)" },
  "contact.name_label": { de: "Ihr Name", nl: "Uw naam" },
  "contact.name_placeholder": { de: "Maria Mustermann", nl: "Jan Jansen" },
  "contact.email_label": { de: "Ihre E-Mail", nl: "Uw e-mail" },
  "contact.email_placeholder": { de: "maria@beispiel.com", nl: "jan@voorbeeld.com" },
  "contact.subject_label": { de: "Betreff", nl: "Onderwerp" },
  "contact.subject_placeholder": { de: "Worum geht es in Ihrer Nachricht?", nl: "Waar gaat uw bericht over?" },
  "contact.body_label": { de: "Ihre Nachricht", nl: "Uw bericht" },
  "contact.body_placeholder": { de: "Schreiben Sie hier. Seien Sie so klar wie möglich, wir lesen jedes Wort.", nl: "Schrijf hier. Wees zo duidelijk mogelijk, we lezen elk woord." },
  "contact.submit": { de: "Senden", nl: "Verzenden" },
  "contact.sending": { de: "Wird gesendet…", nl: "Verzenden…" },
  "contact.success_title": { de: "Nachricht erhalten ✓", nl: "Bericht ontvangen ✓" },
  "contact.success_body": {
    de: "Wir antworten innerhalb von 48 Stunden. Tipp: ein klarer Betreff = schnellere Antwort.",
    nl: "We reageren binnen 48u. Pro tip: een duidelijk onderwerp = sneller antwoord." },
  "contact.error": { de: "Etwas ist schiefgelaufen. Versuchen Sie es erneut oder schreiben Sie an contact@mettrik.ai.", nl: "Er is iets misgegaan. Probeer opnieuw of mail naar contact@mettrik.ai." },
  "contact.privacy_note": {
    de: "Wir behalten Ihre E-Mail nur, um zu antworten. Kein Marketing, kein Verkauf.",
    nl: "We bewaren uw e-mail alleen om te antwoorden. Geen marketing, geen doorverkoop." },

  // ──────────────────── ACCOUNT ────────────────────
  "account.title": { de: "Mein Konto", nl: "Mijn account" },
  "account.subtitle": {
    de: "Verwalten Sie Ihr Profil, Ihre Sicherheit und Ihre Favoriten.",
    nl: "Beheer uw profiel, beveiliging en favorieten." },
  "account.favorites": { de: "Meine Favoriten", nl: "Mijn favorieten" },
  "account.favorites_sub": { de: "Verfolgte Unternehmen & KPIs", nl: "Gevolgde bedrijven & KPI's" },
  "account.signout": { de: "Abmelden", nl: "Uitloggen" },
  "account.signout_sub": { de: "Diese Sitzung beenden", nl: "Deze sessie beëindigen" },
  "account.password.title": { de: "Passwort", nl: "Wachtwoord" },
  "account.password.current": { de: "Aktuelles Passwort", nl: "Huidig wachtwoord" },
  "account.password.new": { de: "Neues Passwort", nl: "Nieuw wachtwoord" },
  "account.password.confirm": { de: "Neues Passwort bestätigen", nl: "Bevestig nieuw wachtwoord" },
  "account.password.update": { de: "Passwort aktualisieren", nl: "Wachtwoord bijwerken" },
  "account.email.title": { de: "E-Mail-Adresse", nl: "E-mailadres" },
  "account.email.send_link": { de: "Bestätigungslink senden", nl: "Bevestigingslink verzenden" },
  "account.delete.title": { de: "Mein Konto löschen", nl: "Mijn account verwijderen" },
  "account.delete.warning": {
    de: "Unwiderrufliche Aktion. Alle Ihre Daten (einschließlich Favoriten) werden sofort gelöscht.",
    nl: "Onomkeerbare actie. Al uw gegevens (inclusief favorieten) worden onmiddellijk gewist." },
  "account.delete.confirm_label": {
    de: "LÖSCHEN eingeben zum Bestätigen",
    nl: "Typ VERWIJDEREN ter bevestiging" },
  "account.delete.button": { de: "Endgültig löschen", nl: "Permanent verwijderen" },
  "account.member_since_prefix": {
    de: "Anmeldung",
    nl: "Aanmelden via" },
  "account.member_since_middle": {
    de: "· Mitglied seit",
    nl: "· lid sinds" },
  "account.password.subtitle_oauth": {
    de: "Sie melden sich über Google an. Sie können ein Mettrik-Passwort über \"Passwort vergessen\" auf der Anmeldeseite festlegen.",
    nl: "U logt in via Google. U kunt een Mettrik-wachtwoord instellen via \"Wachtwoord vergeten\" op de inlogpagina." },
  "account.password.subtitle": {
    de: "Mindestens 8 Zeichen. Wählen Sie eines, das Sie nirgendwo sonst verwenden.",
    nl: "Minimaal 8 tekens. Kies er een die u nergens anders gebruikt." },
  "account.email.subtitle": {
    de: "Ein Bestätigungslink wird an die neue Adresse gesendet, um die Änderung zu validieren.",
    nl: "Er wordt een bevestigingslink naar het nieuwe adres gestuurd om de wijziging te valideren." },
  "account.email.new_label": { de: "Neue E-Mail-Adresse", nl: "Nieuw e-mailadres" },

  // ──────────────────── NAV (dock spy) ────────────────────
  "nav.kpi_principal": { de: "Haupt-KPI", nl: "Hoofd-KPI" },
  "nav.kpi_table": { de: "KPI-Tabelle", nl: "KPI-tabel" },
  "nav.market_position": { de: "Marktposition", nl: "Marktpositie" },
  "nav.risks": { de: "Risikofaktoren", nl: "Risicofactoren" },
  "nav.governance": { de: "Governance & Vergütung", nl: "Bestuur & beloning" },
  "nav.ai": { de: "AI-Positionierung", nl: "AI-positionering" },
  "nav.senate": { de: "US-Senate-Trades", nl: "Trades VS-Senaat" },
  "nav.super_kpi": { de: "Mettrik Super-KPIs", nl: "Mettrik Super-KPI's" },

  // ──────────────────── COMMON UI ────────────────────
  "ui.more_info": { de: "Mehr Infos", nl: "Meer info" },

  // ──────────────────── CMD+F ────────────────────
  "cmdf.placeholder": {
    de: "Auf der Seite suchen…",
    nl: "Zoek op pagina…" },
  "cmdf.next": { de: "Weiter", nl: "Volgende" },
  "cmdf.prev": { de: "Zurück", nl: "Vorige" },
  "cmdf.close": { de: "Schließen", nl: "Sluiten" },

  // ──────────────────── COMMON ────────────────────
  "common.loading": { de: "Laden…", nl: "Laden…" },
  "common.back": { de: "Zurück", nl: "Terug" },
  "nav.home": { de: "Startseite", nl: "Home" },
  "common.close": { de: "Schließen", nl: "Sluiten" },
  "common.cancel": { de: "Abbrechen", nl: "Annuleren" },
  "common.confirm": { de: "Bestätigen", nl: "Bevestigen" },
  "common.copy": { de: "Kopieren", nl: "Kopiëren" },
  "common.copied": { de: "Kopiert", nl: "Gekopieerd" },
  "common.error_generic": {
    de: "Etwas ist schiefgelaufen. Versuchen Sie es erneut.",
    nl: "Er is iets misgegaan. Probeer opnieuw." },

  // ──────────────────── LANGUAGE SWITCHER ────────────────────
  "lang.fr_label": { de: "Französisch", nl: "Frans" },
  "lang.en_label": { de: "Englisch", nl: "Engels" },
  "lang.switch_label": { de: "Sprache wechseln", nl: "Taal wijzigen" },

  // ─── Ajouts CONV-CONCEPTS 9 mai 2026 : 90 clés DE/NL/SV/DA manquantes ───
  // Yann (25 mai 2026) : nouvelle bio FR canonique. EN/DE/NL à traduire si
  // besoin SEO multi-locale (placeholder vide pour l'instant).
  "brand.kpi_intelligence_under": {
    de: "",
    nl: "" },
  "company.ipo_mid.label": {
    de: "IPO {year}: 10-Jahres-Historie unvollständig",
    nl: "IPO {year}: 10-jarige historie onvolledig" },
  "company.ipo_mid.tooltip_body": {
    de: "Unternehmen ist seit 6 bis 10 Jahren börsennotiert. Der 10-Jahres-Chart beginnt erst beim IPO. Vergleiche über ein Jahrzehnt sind teilweise.",
    nl: "Bedrijf is 6 tot 10 jaar beursgenoteerd. De 10-jarige grafiek begint bij de IPO, niet eerder. Vergelijkingen over een decennium zijn gedeeltelijk." },
  "company.ipo_mid.tooltip_title": {
    de: "10-Jahres-Chart abgeschnitten",
    nl: "10-jarige grafiek afgekapt" },
  "company.ipo_old.label": {
    de: "IPO {year}: 20-Jahres-Historie unvollständig",
    nl: "IPO {year}: 20-jarige historie onvolledig" },
  "company.ipo_old.tooltip_body": {
    de: "Unternehmen ist seit 11 bis 20 Jahren börsennotiert. Der 20-Jahres-Chart beginnt beim IPO. Langzeitvergleiche sind partiell.",
    nl: "Bedrijf is 11 tot 20 jaar beursgenoteerd. De 20-jarige grafiek begint bij de IPO. Langetermijnvergelijkingen zijn gedeeltelijk." },
  "company.ipo_old.tooltip_title": {
    de: "20-Jahres-Chart abgeschnitten",
    nl: "20-jarige grafiek afgekapt" },
  "company.ipo_young.label": {
    de: "Junger IPO: {years} Jahre an der Börse ({year})",
    nl: "Recente IPO: {years} jaar beursgenoteerd ({year})" },
  "company.ipo_young.tooltip_body": {
    de: "Unternehmen ist seit weniger als 6 Jahren börsennotiert. CAGR über 5 Jahre, Spitzenwertvergleiche und langfristige Signale sollten mit Vorsicht interpretiert werden.",
    nl: "Bedrijf is minder dan 6 jaar beursgenoteerd. 5-jarige CAGR, piekvergelijkingen en langetermijnsignalen moeten voorzichtig worden gelezen." },
  "company.ipo_young.tooltip_title": {
    de: "Kurze Historie",
    nl: "Korte historie" },
  "contact.lang_notice": {
    de: "Kommunikation auf Französisch, Englisch oder Deutsch.",
    nl: "Gesprekken in het Frans, Engels of Duits." },
  "faq.a.advice": {
    de: "Nein, niemals. Mettrik AI ist kein Anlageberatungsdienst. Alle angezeigten Inhalte (KPI, Scores, Rankings, Peer-Signale, Interpretationen) sind redaktioneller Natur und ersetzen keine Anlageberatung.",
    nl: "Nee, nooit. Mettrik AI is geen beleggingsadviesdienst. Alle getoonde inhoud (KPI's, scores, rankings, peer-signalen, interpretaties) is redactioneel en vervangt geen beleggingsadvies." },
  "faq.a.cancel": {
    de: "In deinem persönlichen Bereich, mit einem Klick. Das Abonnement endet zum Ende der bereits bezahlten Periode und verlängert sich nicht automatisch.",
    nl: "Vanuit je persoonlijke ruimte, met één klik. Het abonnement stopt aan het einde van de reeds betaalde periode en wordt niet automatisch verlengd." },
  "faq.a.coverage": {
    de: "Aktuell: die wichtigsten US-börsennotierten Unternehmen (S&P 500 plus eine laufende SP1500-Erweiterung) und eine europäische und ausländische Auswahl in Vorbereitung.",
    nl: "Op dit moment: de belangrijkste Amerikaanse beursgenoteerde bedrijven (S&P 500 plus een lopende SP1500-uitbreiding) en een Europese en buitenlandse selectie in voorbereiding." },
  "faq.a.data_errors": {
    de: "Melde ihn über das Kontaktformular. Die angezeigten Daten stammen aus einer automatisierten Extraktionskette, die trotz unserer aufeinanderfolgenden Validierungen Fehler enthalten kann.",
    nl: "Meld het via het contactformulier. De getoonde gegevens komen uit een geautomatiseerde extractieketen die ondanks onze opeenvolgende validaties fouten kan bevatten." },
  "faq.a.data_sources": {
    de: "Ausschließlich aus offiziellen öffentlichen Quellen: 10-K, 10-Q, 8-K, DEF 14A bei der SEC für US-Unternehmen, 20-F und Äquivalente für ausländische Emittenten, ergänzt durch Earnings Transcripts.",
    nl: "Uitsluitend uit officiële openbare bronnen: 10-K, 10-Q, 8-K, DEF 14A ingediend bij de SEC voor Amerikaanse bedrijven, 20-F en equivalenten voor buitenlandse uitgevers, aangevuld met earnings transcripts." },
  "faq.a.delete": {
    de: "Ja, jederzeit, in deinem persönlichen Bereich. Die Löschung führt zur Entfernung deines Profils, deiner Watchlists, Notizen und aller damit verbundenen personenbezogenen Daten.",
    nl: "Ja, op elk moment, vanuit je persoonlijke ruimte. Verwijdering leidt tot het wissen van je profiel, watchlists, notities en alle bijbehorende persoonlijke gegevens." },
  "faq.a.free_or_paid": {
    de: "Ein kostenloses Angebot bietet Zugang zu einer Demo-Auswahl von Unternehmen, um den Service zu testen. Bezahlpläne (Premium monatlich, Premium jährlich) öffnen die vollständige Abdeckung und erweiterte Funktionen.",
    nl: "Een gratis abonnement geeft toegang tot een demo-selectie bedrijven om de dienst te evalueren. Betaalde abonnementen (Premium maandelijks, Premium jaarlijks) ontgrendelen volledige dekking en geavanceerde functies." },
  "faq.a.freshness": {
    de: "Bei jeder offiziellen Veröffentlichung des Unternehmens: vierteljährlich für 10-Q und Earnings, jährlich für 10-K, ad hoc für 8-K (wesentliche Ereignisse).",
    nl: "Bij elke officiële publicatie van het bedrijf: per kwartaal voor 10-Q en earnings, jaarlijks voor 10-K, ad hoc voor 8-K (materiële gebeurtenissen)." },
  "faq.a.personal_data": {
    de: "Ja. Authentifizierung über Supabase, Passwörter werden als Hashes gespeichert, Zahlungen werden ausschließlich von Stripe (PCI-DSS-konform) abgewickelt.",
    nl: "Ja. Authenticatie via Supabase, wachtwoorden opgeslagen als hashes, betalingen uitsluitend afgehandeld door Stripe (PCI-DSS conform)." },
  "faq.a.scores_trust": {
    de: "Mettrik-AI-Scores sind redaktionelle Meinungen, die auf einer dokumentierten quantitativen Methodik basieren (Eingangsgewichte, Normalisierung, Peer-Vergleich). Sie sind keine absolute Wahrheit, sondern Entscheidungshilfen.",
    nl: "Mettrik AI-scores zijn redactionele opinies opgebouwd uit een gedocumenteerde kwantitatieve methodologie (inputgewichten, normalisatie, peer-vergelijking). Het is geen absolute waarheid maar een beslissingshulpmiddel." },
  "faq.a.support": {
    de: "Über das Formular auf der Kontaktseite. Anfragen werden nur auf Französisch oder Englisch bearbeitet. Durchschnittliche Antwortzeit: 1 bis 3 Werktage.",
    nl: "Via het formulier op de contactpagina. Communicatie wordt alleen in het Frans of Engels behandeld. Gemiddelde reactietijd: 1 tot 3 werkdagen." },
  "faq.a.what": {
    de: "Mettrik AI aggregiert, strukturiert und präsentiert die nützlichsten KPIs großer börsennotierter Unternehmen: branchenspezifische Geschäftskennzahlen, Risiken, Governance, Wettbewerbspositionierung und KI-Adoption.",
    nl: "Mettrik AI aggregeert, structureert en presenteert de nuttigste KPI's van grote beursgenoteerde bedrijven: sectorspecifieke operationele indicatoren, risico's, governance, concurrentiepositie en AI-adoptie." },
  "faq.disclaimer.body": {
    de: "Mettrik AI veröffentlicht Analysen und Indikatoren ausschließlich zu Informationszwecken. Kein Inhalt der Website (KPI, Score, Ranking) stellt eine Anlageberatung dar.",
    nl: "Mettrik AI publiceert analyses en indicatoren uitsluitend ter informatie. Geen enkele inhoud op de site (KPI, score, ranking) vormt beleggingsadvies." },
  "faq.disclaimer.title": {
    de: "Wichtige Erinnerung:",
    nl: "Belangrijke herinnering:" },
  "faq.q.advice": {
    de: "Sagt mir Mettrik AI, was ich kaufen oder verkaufen soll?",
    nl: "Vertelt Mettrik AI me wat ik moet kopen of verkopen?" },
  "faq.q.cancel": {
    de: "Wie kündige ich mein Abonnement?",
    nl: "Hoe annuleer ik mijn abonnement?" },
  "faq.q.coverage": {
    de: "Welche Unternehmen werden abgedeckt?",
    nl: "Welke bedrijven worden gedekt?" },
  "faq.q.data_errors": {
    de: "Was tun, wenn ich einen Fehler in einer Datenangabe sehe?",
    nl: "Wat te doen als ik een fout in een gegeven zie?" },
  "faq.q.data_sources": {
    de: "Woher kommen die Daten?",
    nl: "Waar komen de gegevens vandaan?" },
  "faq.q.delete": {
    de: "Kann ich mein Konto und meine Daten löschen?",
    nl: "Kan ik mijn account en gegevens verwijderen?" },
  "faq.q.free_or_paid": {
    de: "Ist es kostenlos oder kostenpflichtig?",
    nl: "Is het gratis of betaald?" },
  "faq.q.freshness": {
    de: "Wie häufig werden die KPIs aktualisiert?",
    nl: "Hoe vaak worden de KPI's bijgewerkt?" },
  "faq.q.personal_data": {
    de: "Sind meine personenbezogenen Daten sicher?",
    nl: "Zijn mijn persoonsgegevens veilig?" },
  "faq.q.scores_trust": {
    de: "Wie viel Vertrauen sollte ich den Scores und Rankings entgegenbringen?",
    nl: "Hoeveel vertrouwen kan ik in de scores en rankings stellen?" },
  "faq.q.support": {
    de: "Wie kann ich euch erreichen?",
    nl: "Hoe kan ik jullie bereiken?" },
  "faq.q.what": {
    de: "Was macht Mettrik AI konkret?",
    nl: "Wat doet Mettrik AI concreet?" },
  "faq.subtitle": {
    de: "Alles, was vor der Anmeldung oder einem Abonnement nützlich zu wissen ist.",
    nl: "Alles wat nuttig is om te weten voordat je je inschrijft of abonneert." },
  "faq.title": {
    de: "Häufige Fragen",
    nl: "Veelgestelde vragen" },
  "home.punchline.1": {
    de: "*Seriöser Bankberater* 👨‍💼👔: Sie haben nichts mehr als die anderen, um den Markt zu schlagen! *Ich, selbstbewusst*: Ich allein nicht, aber ich + Mettrik AI schon.",
    nl: "*Serieuze bankadviseur* 👨‍💼👔: u heeft niets meer dan de anderen om de markt te verslaan! *Ik vol vertrouwen*: Ik alleen niet, maar ik + Mettrik AI wel." },
  "home.punchline.2": {
    de: "*Seriöser Bankberater* 👨‍💼👔: Sie werden den Markt nicht schlagen können? *Ich, selbstbewusst*: Allein ohne Informationen nein, aber ich + Mettrik AI schon.",
    nl: "*Serieuze bankadviseur* 👨‍💼👔: u zult de markt niet kunnen verslaan? *Ik vol vertrouwen*: Alleen zonder informatie nee, maar ik + Mettrik AI wel." },
  "home.punchline.3": {
    de: "📚 📖 Frage: Wie verschafft man sich einen Wettbewerbsvorteil gegenüber den Kollegen an der Kaffeemaschine? Antwort: Mettrik AI nutzen.",
    nl: "📚 📖 Vraag: Hoe krijg je een concurrentievoordeel op je collega's bij het koffieapparaat? Antwoord: Mettrik AI gebruiken." },
  "home.punchline.4": {
    de: "👦 Sag mal, Papa, wie hast du dir einen Wettbewerbsvorteil gegenüber den anderen geholt und behalten? 👨 Ich nutze Mettrik AI, mein Sohn, immer.",
    nl: "👦 Zeg pap, hoe heb jij een concurrentievoordeel op anderen gekregen en behouden? 👨 Ik gebruik Mettrik AI, mijn zoon, altijd." },
  "pricing.badge_currencies": {
    de: "Preise in 7 Währungen",
    nl: "Prijzen in 7 valuta" },
  "pricing.badge_no_engagement": {
    de: "Ohne Bindung, Kündigung mit 1 Klick",
    nl: "Zonder verplichting, opzeggen in 1 klik" },
  "pricing.badge_refund": {
    de: "30 Tage Geld-zurück-Garantie",
    nl: "30 dagen geld terug" },
  "pricing.compare_sub": {
    de: "Alle Funktionen, klar erklärt, damit du ohne Überraschung entscheidest.",
    nl: "Alle functies, helder uitgelegd, zodat je zonder verrassingen kiest." },
  "pricing.compare_title": {
    de: "Detaillierter Vergleich",
    nl: "Gedetailleerde vergelijking" },
  "pricing.cta_final_body": {
    de: "Starte in 30 Sekunden, ohne Kreditkarte. Du kannst jederzeit auf Premium oder Max upgraden, wenn du bereit bist.",
    nl: "Begin in 30 seconden, zonder creditcard. Je kunt op elk moment upgraden naar Premium of Max wanneer je klaar bent." },
  "pricing.cta_final_btn": {
    de: "Kostenlos starten",
    nl: "Gratis starten" },
  "pricing.cta_final_email": {
    de: "Eine Frage? Wir sind da.",
    nl: "Een vraag? We zijn er." },
  "pricing.cta_final_title": {
    de: "Bereit, deine Unternehmen aus einem neuen Blickwinkel zu sehen?",
    nl: "Klaar om je bedrijven vanuit een nieuw perspectief te zien?" },
  "pricing.eyebrow": {
    de: "Einfache Preise, leistungsstarker Zugang",
    nl: "Eenvoudige prijzen, krachtige toegang" },
  "pricing.faq_a1": {
    de: "Ja, der Discovery-Plan ist auf Lebenszeit kostenlos. Du erhältst vollen Zugriff auf Google (GOOGL) und Meta (META) ohne Kreditkarte. Genug, um das Tool zu evaluieren.",
    nl: "Ja, het Discovery-abonnement is voor altijd gratis. Je krijgt volledige toegang tot Google (GOOGL) en Meta (META) zonder creditcard. Genoeg om de tool te evalueren." },
  "pricing.faq_a2": {
    de: "Über dein Konto (Mein Profil > Abrechnung), mit einem Klick. Keine Strafe, dein Zugang bleibt bis zum Ende der bezahlten Periode aktiv.",
    nl: "Vanuit je account (Mijn profiel > Facturatie), met één klik. Geen boete, je toegang blijft actief tot het einde van de betaalde periode." },
  "pricing.faq_a3": {
    de: "US-Börsen: NYSE, NASDAQ. Europäische Börsen: Euronext, Xetra (DAX), London (FTSE 100), Borsa Italiana, BME, SIX Schweiz, Nasdaq Stockholm. Asiatische Börsen (im Aufbau): Tokio (Japan), KRX (Korea), ASX (Australien), TWSE (Taiwan), SGX (Singapur). Der Katalog wächst monatlich.",
    nl: "Amerikaanse beurzen: NYSE, NASDAQ. Europese beurzen: Euronext, Xetra (DAX), Londen (FTSE 100), Borsa Italiana, BME, SIX Zwitserland, Nasdaq Stockholm. Aziatische beurzen (in uitrol): Tokio (Japan), KRX (Korea), ASX (Australië), TWSE (Taiwan), SGX (Singapore). De catalogus groeit maandelijks." },
  "pricing.faq_a4": {
    de: "Ja, jederzeit. Wenn du von Premium zu Max wechselst, wird die Differenz anteilig berechnet. Bei einem Downgrade wird die Änderung bei der nächsten Verlängerung wirksam.",
    nl: "Ja, altijd. Bij upgrade van Premium naar Max wordt het verschil pro rata gefactureerd. Bij downgrade gaat de wijziging in bij de volgende verlenging." },
  "pricing.faq_q1": {
    de: "Kann ich Mettrik AI testen, ohne zu zahlen?",
    nl: "Kan ik Mettrik AI testen zonder te betalen?" },
  "pricing.faq_q2": {
    de: "Wie kündige ich mein Abonnement?",
    nl: "Hoe annuleer ik mijn abonnement?" },
  "pricing.faq_q3": {
    de: "Welche Unternehmen sind in Premium und Max abgedeckt?",
    nl: "Welke bedrijven zijn opgenomen in Premium en Max?" },
  "pricing.faq_q4": {
    de: "Kann ich später den Plan wechseln?",
    nl: "Kan ik later van abonnement wisselen?" },
  "pricing.faq_title": {
    de: "Häufige Fragen",
    nl: "Veelgestelde vragen" },
  "pricing.h1": {
    de: "Der richtige Plan für deine Art zu investieren",
    nl: "Het juiste plan voor jouw manier van beleggen" },
  "pricing.intro": {
    de: "Entdecke Mettrik AI kostenlos auf Google und Meta. Wenn du weiter gehen willst, schaltest du die 1.000 größten Unternehmen weltweit mit einem Klick frei.",
    nl: "Ontdek Mettrik AI gratis op Google en Meta. Wanneer je verder wilt, ontgrendel je de 1.000 grootste bedrijven ter wereld met één klik." },
  "pricing.trust1_body": {
    de: "Jede Zahl stammt aus offiziellen Dokumenten (10-K, 20-F, Transcripts), die die Unternehmen selbst eingereicht haben. Keine hauseigenen Schätzungen.",
    nl: "Elk cijfer komt uit officiële documenten (10-K, 20-F, transcripts) die door de bedrijven zelf zijn ingediend. Geen eigen schattingen." },
  "pricing.trust1_title": {
    de: "Verifizierte Daten",
    nl: "Geverifieerde gegevens" },
  "pricing.trust2_body": {
    de: "Wir verkaufen oder vermieten deine Daten nicht an Dritte. Keine Werbe-Tracker, keine Datenhändler.",
    nl: "We verkopen of verhuren je gegevens niet aan derden. Geen advertentietrackers, geen datamakelaars." },
  "pricing.trust2_title": {
    de: "Kein Verkauf deiner Daten",
    nl: "Geen doorverkoop van je gegevens" },
  "pricing.trust3_body": {
    de: "Deine Daten bleiben in Europa. DSGVO-konform. Abrechnung durch R consulting (Schweiz).",
    nl: "Je gegevens blijven in Europa. AVG-conform. Facturatie door R consulting (Zwitserland)." },
  "pricing.trust3_title": {
    de: "Hosting in Europa",
    nl: "Europese hosting" },
  "senate.show_less": {
    de: "Weniger anzeigen",
    nl: "Minder tonen" },
  "senate.show_more_prefix": {
    de: "Anzeigen",
    nl: "Toon" },
  "senate.tx_many": {
    de: "Transaktionen",
    nl: "transacties" },
  "senate.tx_one": {
    de: "Transaktion",
    nl: "transactie" },
  "timefrac.suffix.day": {
    de: "pro Tag",
    nl: "per dag" },
  "timefrac.suffix.hour": {
    de: "pro Stunde",
    nl: "per uur" },
  "timefrac.suffix.minute": {
    de: "pro Minute",
    nl: "per minuut" },
  "timefrac.suffix.month": {
    de: "pro Monat",
    nl: "per maand" },
  "timefrac.suffix.second": {
    de: "pro Sekunde",
    nl: "per seconde" },
  "timefrac.suffix.week": {
    de: "pro Woche",
    nl: "per week" },
  "timefrac.suffix.year": {
    de: "pro Jahr",
    nl: "per jaar" },
  "transcript.extraction_pending": {
    de: "LLM-Extraktion durch die Daten-Pipeline läuft.",
    nl: "LLM-extractie via de datapipeline bezig." },
  "transcript.figures_title": {
    de: "Zahlen & Guidance",
    nl: "Cijfers & guidance" },
  "transcript.no_data": {
    de: "Aktuell keine Zitate extrahiert.",
    nl: "Op dit moment geen citaten geëxtraheerd." },
  "transcript.no_figures": {
    de: "Aktuell keine Zahlen extrahiert.",
    nl: "Op dit moment geen cijfers geëxtraheerd." },
  "transcript.quotes_title": {
    de: "Zitate des Managements",
    nl: "Citaten management" },
  "transcript.section_subtitle": {
    de: "Exklusive Einblicke vom Top-Management an Investoren beim letzten Earnings Call.",
    nl: "Exclusieve inzichten van het topmanagement aan investeerders tijdens de laatste resultatencall." },
  "transcript.section_title": {
    de: "Letzter Earnings Call",
    nl: "Laatste earnings call" },
  "transcript.sentiment.bullish": {
    de: "Zuversichtlich",
    nl: "Optimistisch" },
  "transcript.sentiment.cautious": {
    de: "Vorsichtig",
    nl: "Voorzichtig" },
  "transcript.sentiment.neutral": {
    de: "Neutral",
    nl: "Neutraal" },

  /* ──── Pricing cards strings (Yann 11 mai 2026 — extra locales) ──── */
  "pricing.card.recommended": {
    de: "Empfohlen",
    nl: "Aanbevolen" },
  "pricing.unit.per_month": {
    de: "/Monat",
    nl: "/maand" },
  "pricing.unit.per_day": {
    de: "/Tag",
    nl: "/dag" },
  "pricing.unit.per_week": {
    de: "/Woche",
    nl: "/week" },
  "pricing.card.billed_annually_prefix": {
    de: "Also",
    nl: "Oftewel" },
  "pricing.card.billed_annually_suffix": {
    de: "jährlich abgerechnet",
    nl: "jaarlijks gefactureerd" },
  "pricing.card.no_engagement_short": {
    de: "Keine Bindung",
    nl: "Geen verplichting" },
  "pricing.card.coffee_slogan_part1": {
    de: "Weniger als der Preis eines Kaffees,",
    nl: "Minder dan de prijs van een koffie," },
  "pricing.card.coffee_slogan_part2": {
    de: "aber viel besser investiert!",
    nl: "maar veel beter geïnvesteerd!" },
  "pricing.card.currency_not_available": {
    de: "Bald in dieser Währung verfügbar",
    nl: "Binnenkort beschikbaar in deze valuta" },
  "pricing.matrix.feature_col": {
    de: "Funktion",
    nl: "Functie" },
  "pricing.matrix.free": {
    de: "Kostenlos",
    nl: "Gratis" },
  "pricing.matrix.billed_annually_short": {
    de: "jährliche Abrechnung",
    nl: "jaarlijkse facturatie" } };

/** Merge les EXTRA_LOCALES dans une entry du DICTIONARY. */
export function applyExtraLocale(key: string, base: { fr: string; en: string }): Record<string, string> {
  const extra = EXTRA_LOCALES[key];
  if (!extra) return base as Record<string, string>;
  return { ...base, ...extra };
}
