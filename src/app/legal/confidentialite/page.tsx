import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";
import { getServerLocale } from "@/lib/i18n/server";

export const metadata = {
  title: "Politique de confidentialité · Mettrik AI",
  description: "Politique de confidentialité et traitement des données personnelles Mettrik AI.",
};

const STR = {
  fr: {
    title: "Politique de confidentialité",
    updatedAt: "29 avril 2026",
    intro_1_a: "La présente politique de confidentialité décrit la manière dont Mettrik AI collecte, utilise, conserve et protège vos données personnelles dans le cadre de l'utilisation du site",
    intro_site: "www.mettrik.ai",
    intro_1_b: "et de ses services.",
    intro_2: "Cette politique est conforme au Règlement Général sur la Protection des Données (RGPD - Règlement UE 2016/679), applicable au Liechtenstein en tant que membre de l'Espace économique européen, et à la loi liechtensteinoise sur la protection des données (DSG).",
    s1_title: "1. Responsable du traitement",
    s1_p1_a: "Le responsable du traitement de vos données personnelles est",
    s1_p1_b: "R consulting",
    s1_p1_c: ", entreprise individuelle de droit liechtensteinois (exploitant la marque",
    s1_p1_d: "Mettrik AI",
    s1_p1_e: "), établie au",
    s1_p1_addr: "Aeulestrasse 74, 9490 Vaduz, Liechtenstein",
    s1_p1_f: ".",
    s1_dpo_label: "Délégué à la Protection des Données (DPO) :",
    s2_title: "2. Données collectées",
    s2_intro: "Mettrik AI collecte les catégories de données suivantes :",
    s2_li1_b: "Données d'identification :",
    s2_li1_t: "adresse email, mot de passe (haché), nom (optionnel) lors de la création de compte ;",
    s2_li2_b: "Données de connexion :",
    s2_li2_t: "dates et heures de connexion, adresse IP (anonymisée après 30 jours) ;",
    s2_li3_b: "Données de paiement :",
    s2_li3_t: "traitées exclusivement par Stripe. Mettrik AI ne stocke aucune donnée bancaire (numéro de carte, CVC, etc.) ;",
    s2_li4_b: "Données d'usage :",
    s2_li4_t: "sociétés consultées, KPIs favoris, watchlists. Utilisées uniquement pour personnaliser votre expérience ;",
    s2_li5_b: "Données techniques :",
    s2_li5_t: "navigateur, OS, résolution d'écran (utilisées pour optimiser le service).",
    s3_title: "3. Finalités du traitement",
    s3_intro: "Vos données sont traitées pour les finalités suivantes :",
    s3_li1: "Fournir le service Mettrik AI (gestion du compte, accès aux contenus, personnalisation) ;",
    s3_li2: "Gérer la facturation et le suivi des abonnements ;",
    s3_li3: "Communiquer avec vous (notifications transactionnelles, support, mises à jour produit) ;",
    s3_li4: "Améliorer le service (analyse statistique anonymisée) ;",
    s3_li5: "Respecter nos obligations légales (comptabilité, fiscalité).",
    s4_title: "4. Bases légales",
    s4_intro: "Le traitement de vos données repose sur les bases légales suivantes :",
    s4_li1_b: "Exécution du contrat :",
    s4_li1_t: "nécessaire pour fournir le service (compte, abonnement) ;",
    s4_li2_b: "Consentement :",
    s4_li2_t: "pour les communications marketing facultatives ;",
    s4_li3_b: "Intérêt légitime :",
    s4_li3_t: "pour les analyses statistiques anonymisées et la sécurité du service ;",
    s4_li4_b: "Obligation légale :",
    s4_li4_t: "pour la comptabilité, la fiscalité, et la lutte contre la fraude.",
    s5_title: "5. Sous-traitants et hébergement",
    s5_p1_a: "Pour le traitement des paiements, Mettrik AI fait appel à",
    s5_p1_b: "Stripe Payments Europe Ltd.",
    s5_p1_c: "(Irlande), conforme aux normes PCI-DSS Level 1 et au Règlement (UE) 2016/679 (RGPD). Stripe agit de manière autonome dans le traitement des données bancaires confiées par l'utilisateur lors du paiement.",
    s5_p2: "Pour les autres traitements techniques (hébergement, base de données, envoi d'emails transactionnels, analytics anonymes), Mettrik AI fait appel à des sous-traitants sélectionnés selon les critères de l'article 28 du RGPD : engagements contractuels, garanties de sécurité (chiffrement au repos et en transit, audits SOC 2, certifications ISO 27001 ou équivalentes), localisation préférentielle des données dans l'Espace Économique Européen.",
    s5_p3_a: "La liste détaillée des sous-traitants techniques, avec leur rôle, leur base juridique et les garanties associées, est disponible sur demande écrite à",
    s5_p3_b: ". Les éventuels transferts hors UE sont encadrés par des Clauses Contractuelles Types approuvées par la Commission européenne ou par des décisions d'adéquation en vigueur.",
    s6_title: "6. Durée de conservation",
    s6_intro: "Vos données sont conservées :",
    s6_li1_b: "Données de compte actif :",
    s6_li1_t: "tant que le compte est actif, puis 30 jours après suppression ;",
    s6_li2_b: "Données de facturation :",
    s6_li2_t: "10 ans (obligation légale comptable) ;",
    s6_li3_b: "Données de connexion :",
    s6_li3_t: "1 an maximum, puis anonymisation ;",
    s6_li4_b: "Logs techniques :",
    s6_li4_t: "90 jours.",
    s7_title: "7. Vos droits",
    s7_intro: "Conformément au RGPD, vous disposez des droits suivants :",
    s7_li1_b: "Droit d'accès :",
    s7_li1_t: "obtenir une copie des données vous concernant ;",
    s7_li2_b: "Droit de rectification :",
    s7_li2_t: "corriger des données inexactes ;",
    s7_li3_b: "Droit à l'effacement",
    s7_li3_t: "(« droit à l'oubli ») : demander la suppression de vos données ;",
    s7_li4_b: "Droit à la portabilité :",
    s7_li4_t: "recevoir vos données dans un format structuré ;",
    s7_li5_b: "Droit d'opposition :",
    s7_li5_t: "vous opposer au traitement pour motif légitime ;",
    s7_li6_b: "Droit à la limitation :",
    s7_li6_t: "demander la limitation du traitement ;",
    s7_li7_b: "Droit de retirer votre consentement :",
    s7_li7_t: "à tout moment pour les traitements basés sur le consentement.",
    s7_p_contact_a: "Pour exercer ces droits, contactez :",
    s7_p_contact_b: ". Mettrik AI vous répondra dans un délai maximum de 30 jours.",
    s7_p_cnil_a: "Vous disposez également du droit d'introduire une réclamation auprès de l'autorité de protection des données du Liechtenstein, la Datenschutzstelle (",
    s7_p_cnil_b: "), ou auprès de l'autorité de contrôle de votre État de résidence dans l'Espace économique européen (",
    s7_p_cnil_c: ").",
    s8_title: "8. Cookies et traceurs",
    s8_p1: "Mettrik AI utilise un nombre minimal de cookies, strictement nécessaires au fonctionnement du service (cookies de session, cookies d'authentification). Aucun cookie publicitaire ou de profilage n'est utilisé.",
    s8_p2_a: "Pour les statistiques d'audience, Mettrik AI utilise",
    s8_p2_b: "Plausible Analytics",
    s8_p2_c: "(à confirmer), un service privacy-first qui ne dépose aucun cookie et n'identifie pas les visiteurs individuellement. Aucun consentement n'est donc requis pour les statistiques.",
    s9_title: "9. Sécurité",
    s9_p1: "Mettrik AI met en œuvre les mesures techniques et organisationnelles appropriées pour protéger vos données contre l'accès, la modification, la divulgation ou la destruction non autorisés : chiffrement HTTPS, authentification sécurisée (mots de passe hachés bcrypt), accès restreint aux bases de données, audits réguliers.",
    s10_title: "10. Modifications",
    s10_p1: "La présente politique peut être modifiée. Toute modification substantielle sera notifiée par email aux utilisateurs avec un compte actif au moins 30 jours avant son entrée en vigueur.",
  },
  en: {
    title: "Privacy Policy",
    updatedAt: "April 29, 2026",
    intro_1_a: "This privacy policy describes how Mettrik AI collects, uses, retains and protects your personal data in connection with your use of the website",
    intro_site: "www.mettrik.ai",
    intro_1_b: "and its services.",
    intro_2: "This policy complies with the General Data Protection Regulation (GDPR - EU Regulation 2016/679), applicable in Liechtenstein as a member of the European Economic Area, and with the Liechtenstein Data Protection Act (DSG).",
    s1_title: "1. Data Controller",
    s1_p1_a: "The controller of your personal data is",
    s1_p1_b: "R consulting",
    s1_p1_c: ", a sole proprietorship under Liechtenstein law (operating the brand",
    s1_p1_d: "Mettrik AI",
    s1_p1_e: "), established at",
    s1_p1_addr: "Aeulestrasse 74, 9490 Vaduz, Liechtenstein",
    s1_p1_f: ".",
    s1_dpo_label: "Data Protection Officer (DPO):",
    s2_title: "2. Data Collected",
    s2_intro: "Mettrik AI collects the following categories of data:",
    s2_li1_b: "Identification data:",
    s2_li1_t: "email address, password (hashed), name (optional) when creating an account;",
    s2_li2_b: "Connection data:",
    s2_li2_t: "login dates and times, IP address (anonymized after 30 days);",
    s2_li3_b: "Payment data:",
    s2_li3_t: "processed exclusively by Stripe. Mettrik AI does not store any banking data (card number, CVC, etc.);",
    s2_li4_b: "Usage data:",
    s2_li4_t: "companies viewed, favorite KPIs, watchlists. Used only to personalize your experience;",
    s2_li5_b: "Technical data:",
    s2_li5_t: "browser, OS, screen resolution (used to optimize the service).",
    s3_title: "3. Purposes of Processing",
    s3_intro: "Your data is processed for the following purposes:",
    s3_li1: "Provide the Mettrik AI service (account management, content access, personalization);",
    s3_li2: "Manage billing and subscription tracking;",
    s3_li3: "Communicate with you (transactional notifications, support, product updates);",
    s3_li4: "Improve the service (anonymized statistical analysis);",
    s3_li5: "Comply with our legal obligations (accounting, taxation).",
    s4_title: "4. Legal Bases",
    s4_intro: "The processing of your data is based on the following legal grounds:",
    s4_li1_b: "Performance of contract:",
    s4_li1_t: "necessary to provide the service (account, subscription);",
    s4_li2_b: "Consent:",
    s4_li2_t: "for optional marketing communications;",
    s4_li3_b: "Legitimate interest:",
    s4_li3_t: "for anonymized statistical analysis and security of the service;",
    s4_li4_b: "Legal obligation:",
    s4_li4_t: "for accounting, taxation, and fraud prevention.",
    s5_title: "5. Subprocessors and Hosting",
    s5_p1_a: "For payment processing, Mettrik AI uses",
    s5_p1_b: "Stripe Payments Europe Ltd.",
    s5_p1_c: "(Ireland), compliant with PCI-DSS Level 1 standards and EU Regulation 2016/679 (GDPR). Stripe acts independently in the processing of banking data entrusted by the user at the time of payment.",
    s5_p2: "For other technical processing (hosting, database, transactional email delivery, anonymous analytics), Mettrik AI uses subprocessors selected according to the criteria of Article 28 of the GDPR: contractual commitments, security guarantees (encryption at rest and in transit, SOC 2 audits, ISO 27001 or equivalent certifications), with preferential data location in the European Economic Area.",
    s5_p3_a: "A detailed list of technical subprocessors, with their role, legal basis and associated guarantees, is available upon written request to",
    s5_p3_b: ". Any transfers outside the EU are governed by Standard Contractual Clauses approved by the European Commission or by adequacy decisions in force.",
    s6_title: "6. Retention Period",
    s6_intro: "Your data is retained as follows:",
    s6_li1_b: "Active account data:",
    s6_li1_t: "as long as the account is active, then 30 days after deletion;",
    s6_li2_b: "Billing data:",
    s6_li2_t: "10 years (legal accounting obligation);",
    s6_li3_b: "Connection data:",
    s6_li3_t: "1 year maximum, then anonymization;",
    s6_li4_b: "Technical logs:",
    s6_li4_t: "90 days.",
    s7_title: "7. Your Rights",
    s7_intro: "In accordance with the GDPR, you have the following rights:",
    s7_li1_b: "Right of access:",
    s7_li1_t: "obtain a copy of the data concerning you;",
    s7_li2_b: "Right of rectification:",
    s7_li2_t: "correct inaccurate data;",
    s7_li3_b: "Right to erasure",
    s7_li3_t: "(\"right to be forgotten\"): request the deletion of your data;",
    s7_li4_b: "Right to portability:",
    s7_li4_t: "receive your data in a structured format;",
    s7_li5_b: "Right to object:",
    s7_li5_t: "object to processing on legitimate grounds;",
    s7_li6_b: "Right to restriction:",
    s7_li6_t: "request the restriction of processing;",
    s7_li7_b: "Right to withdraw consent:",
    s7_li7_t: "at any time for processing based on consent.",
    s7_p_contact_a: "To exercise these rights, contact:",
    s7_p_contact_b: ". Mettrik AI will respond within a maximum of 30 days.",
    s7_p_cnil_a: "You also have the right to lodge a complaint with the Liechtenstein data protection authority, the Datenschutzstelle (",
    s7_p_cnil_b: "), or with the supervisory authority of your state of residence within the European Economic Area (",
    s7_p_cnil_c: ").",
    s8_title: "8. Cookies and Trackers",
    s8_p1: "Mettrik AI uses a minimal number of cookies, strictly necessary for the operation of the service (session cookies, authentication cookies). No advertising or profiling cookies are used.",
    s8_p2_a: "For audience statistics, Mettrik AI uses",
    s8_p2_b: "Plausible Analytics",
    s8_p2_c: "(to be confirmed), a privacy-first service that does not place any cookies and does not identify visitors individually. No consent is therefore required for statistics.",
    s9_title: "9. Security",
    s9_p1: "Mettrik AI implements appropriate technical and organizational measures to protect your data against unauthorized access, modification, disclosure or destruction: HTTPS encryption, secure authentication (bcrypt-hashed passwords), restricted access to databases, regular audits.",
    s10_title: "10. Changes",
    s10_p1: "This policy may be modified. Any substantial change will be notified by email to users with an active account at least 30 days before its entry into force.",
  },
};

export default async function ConfidentialitePage() {
  const rawLocale = await getServerLocale();
  const locale: "fr" | "en" = rawLocale === "fr" ? "fr" : "en";
  const t = locale === "fr" ? STR.fr : STR.en;

  return (
    <LegalLayout title={t.title} updatedAt={t.updatedAt} locale={locale}>
      <p>
        {t.intro_1_a} <strong>{t.intro_site}</strong> {t.intro_1_b}
      </p>
      <p>{t.intro_2}</p>

      <LegalSection title={t.s1_title}>
        <p>
          {t.s1_p1_a} <strong>{t.s1_p1_b}</strong> {t.s1_p1_c} <strong>{t.s1_p1_d}</strong>
          {t.s1_p1_e} <strong>{t.s1_p1_addr}</strong>{t.s1_p1_f}
        </p>
        <p>
          {t.s1_dpo_label}
          <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline"> contact@mettrik.ai</a>
        </p>
      </LegalSection>

      <LegalSection title={t.s2_title}>
        <p>{t.s2_intro}</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>{t.s2_li1_b}</strong> {t.s2_li1_t}</li>
          <li><strong>{t.s2_li2_b}</strong> {t.s2_li2_t}</li>
          <li><strong>{t.s2_li3_b}</strong> {t.s2_li3_t}</li>
          <li><strong>{t.s2_li4_b}</strong> {t.s2_li4_t}</li>
          <li><strong>{t.s2_li5_b}</strong> {t.s2_li5_t}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t.s3_title}>
        <p>{t.s3_intro}</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>{t.s3_li1}</li>
          <li>{t.s3_li2}</li>
          <li>{t.s3_li3}</li>
          <li>{t.s3_li4}</li>
          <li>{t.s3_li5}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t.s4_title}>
        <p>{t.s4_intro}</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>{t.s4_li1_b}</strong> {t.s4_li1_t}</li>
          <li><strong>{t.s4_li2_b}</strong> {t.s4_li2_t}</li>
          <li><strong>{t.s4_li3_b}</strong> {t.s4_li3_t}</li>
          <li><strong>{t.s4_li4_b}</strong> {t.s4_li4_t}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t.s5_title}>
        <p>
          {t.s5_p1_a} <strong>{t.s5_p1_b}</strong> {t.s5_p1_c}
        </p>
        <p>{t.s5_p2}</p>
        <p>
          {t.s5_p3_a}
          <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline"> contact@mettrik.ai</a>
          {t.s5_p3_b}
        </p>
      </LegalSection>

      <LegalSection title={t.s6_title}>
        <p>{t.s6_intro}</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>{t.s6_li1_b}</strong> {t.s6_li1_t}</li>
          <li><strong>{t.s6_li2_b}</strong> {t.s6_li2_t}</li>
          <li><strong>{t.s6_li3_b}</strong> {t.s6_li3_t}</li>
          <li><strong>{t.s6_li4_b}</strong> {t.s6_li4_t}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t.s7_title}>
        <p>{t.s7_intro}</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>{t.s7_li1_b}</strong> {t.s7_li1_t}</li>
          <li><strong>{t.s7_li2_b}</strong> {t.s7_li2_t}</li>
          <li><strong>{t.s7_li3_b}</strong> {t.s7_li3_t}</li>
          <li><strong>{t.s7_li4_b}</strong> {t.s7_li4_t}</li>
          <li><strong>{t.s7_li5_b}</strong> {t.s7_li5_t}</li>
          <li><strong>{t.s7_li6_b}</strong> {t.s7_li6_t}</li>
          <li><strong>{t.s7_li7_b}</strong> {t.s7_li7_t}</li>
        </ul>
        <p>
          {t.s7_p_contact_a} <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline">contact@mettrik.ai</a>
          {t.s7_p_contact_b}
        </p>
        <p>
          {t.s7_p_cnil_a}<a href="https://www.datenschutzstelle.li" className="text-violet-300 hover:underline">www.datenschutzstelle.li</a>
          {t.s7_p_cnil_b}<a href="https://www.edpb.europa.eu/about-edpb/about-edpb/members_fr" className="text-violet-300 hover:underline">liste des autorités EEE</a>
          {t.s7_p_cnil_c}
        </p>
      </LegalSection>

      <LegalSection title={t.s8_title}>
        <p>{t.s8_p1}</p>
        <p>
          {t.s8_p2_a} <strong>{t.s8_p2_b}</strong> {t.s8_p2_c}
        </p>
      </LegalSection>

      <LegalSection title={t.s9_title}>
        <p>{t.s9_p1}</p>
      </LegalSection>

      <LegalSection title={t.s10_title}>
        <p>{t.s10_p1}</p>
      </LegalSection>
    </LegalLayout>
  );
}
