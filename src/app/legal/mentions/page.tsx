import { LegalLayout, LegalSection, ToFill } from "@/components/legal/legal-layout";
import { getServerLocale } from "@/lib/i18n/server";

export const metadata = {
  title: "Mentions légales · Mettrik AI",
  description: "Mentions légales du site Mettrik AI.",
};

const STR = {
  fr: {
    title: "Mentions légales",
    updatedAt: "31 août 2026",
    intro_1: "Ces mentions légales s'appliquent à l'ensemble des pages publiées sur le site",
    intro_site: "www.mettrik.ai",
    intro_2: "et services associés.",
    s1_title: "1. Éditeur du site",
    s1_p1_a: "Le site est exploité par",
    s1_p1_b: "R consulting",
    s1_p1_c: ", entreprise individuelle de droit suisse (exploitant la marque Mettrik AI), établie à l'adresse :",
    s1_p1_addr: "Leubernstrasse 3, 8280 Kreuzlingen, Suisse",
    s1_p1_d: ".",
    s1_contact_label: "Contact :",
    s1_siren_label: "IDE :",
    s1_siren_value: "CHE-XXX.XXX.XXX",
    s1_tva_label: "TVA :",
    s1_tva_value: "prix nets, aucune TVA facturée en sus",
    s1_pub_label: "Responsable de la publication :",
    s1_pub_value: "R consulting",
    s2_title: "2. Hébergement",
    s2_p1_a: "Le site est hébergé par",
    s2_p1_b: "Vercel Inc.",
    s2_p1_c: ", 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis. Site web :",
    s2_p2_a: "La base de données et l'authentification sont fournies par",
    s2_p2_b: "Supabase Inc.",
    s2_p2_c: "(région d'hébergement :",
    s2_p2_tofill: "EU West Frankfurt à confirmer après création projet prod",
    s2_p2_d: ").",
    s3_title: "3. Propriété intellectuelle",
    s3_p1: "L'ensemble des contenus présents sur le site (textes, graphismes, logos, icônes, images, vidéos, code source) est la propriété exclusive de Mettrik AI ou de ses partenaires, et est protégé par les lois en vigueur sur la propriété intellectuelle.",
    s3_p2: "Toute reproduction, représentation, modification, publication, transmission, dénaturation, totale ou partielle du site ou de son contenu, par quelque procédé que ce soit, et sur quelque support que ce soit, est interdite sans autorisation écrite préalable de Mettrik AI.",
    s4_title: "4. Liens hypertextes",
    s4_p1: "Le site peut contenir des liens hypertextes pointant vers d'autres sites internet. Mettrik AI n'exerce aucun contrôle sur le contenu de ces sites tiers et ne saurait être tenu responsable de leur contenu, fonctionnement, ou utilisation par les visiteurs.",
    s5_title: "5. Limitation de responsabilité",
    s5_p1_a: "Mettrik AI fournit des analyses de KPIs sur des sociétés cotées",
    s5_p1_b: "à titre informatif uniquement",
    s5_p1_c: ". Les contenus présentés",
    s5_p1_d: "ne constituent pas un conseil en investissement",
    s5_p1_e: ", ni une recommandation d'achat ou de vente d'instruments financiers. Les performances passées ne préjugent pas des performances futures. Toute décision d'investissement basée sur les contenus du site relève de la seule responsabilité de l'utilisateur.",
    s5_p2: "Mettrik AI s'efforce d'assurer l'exactitude des informations diffusées, mais ne peut garantir l'exactitude, la précision ou l'exhaustivité des informations mises à disposition sur le site. La responsabilité de Mettrik AI ne saurait être engagée en cas d'erreur ou d'omission.",
    s6_title: "6. Droit applicable et juridiction",
    s6_p1: "Les présentes mentions légales sont régies par le droit suisse. Tout litige relatif à leur interprétation ou à leur exécution relèvera de la compétence des tribunaux ordinaires du siège de l'exploitant (Kreuzlingen, Thurgovie), sous réserve des dispositions impératives protégeant les consommateurs.",
  },
  en: {
    title: "Legal Notice",
    updatedAt: "August 31, 2026",
    intro_1: "This legal notice applies to all pages published on the website",
    intro_site: "www.mettrik.ai",
    intro_2: "and related services.",
    s1_title: "1. Website Publisher",
    s1_p1_a: "The website is operated by",
    s1_p1_b: "R consulting",
    s1_p1_c: ", a sole proprietorship under Swiss law (operating the Mettrik AI brand), established at:",
    s1_p1_addr: "Leubernstrasse 3, 8280 Kreuzlingen, Switzerland",
    s1_p1_d: ".",
    s1_contact_label: "Contact:",
    s1_siren_label: "UID:",
    s1_siren_value: "CHE-XXX.XXX.XXX",
    s1_tva_label: "VAT:",
    s1_tva_value: "net prices, no VAT charged in addition",
    s1_pub_label: "Publication responsibility:",
    s1_pub_value: "R consulting",
    s2_title: "2. Hosting",
    s2_p1_a: "The website is hosted by",
    s2_p1_b: "Vercel Inc.",
    s2_p1_c: ", 340 S Lemon Ave #4133, Walnut, CA 91789, United States. Website:",
    s2_p2_a: "The database and authentication are provided by",
    s2_p2_b: "Supabase Inc.",
    s2_p2_c: "(hosting region:",
    s2_p2_tofill: "EU West Frankfurt to be confirmed after production project setup",
    s2_p2_d: ").",
    s3_title: "3. Intellectual Property",
    s3_p1: "All content on the website (texts, graphics, logos, icons, images, videos, source code) is the exclusive property of Mettrik AI or its partners, and is protected by applicable intellectual property laws.",
    s3_p2: "Any reproduction, representation, modification, publication, transmission, alteration, in whole or in part, of the website or its content, by any process whatsoever, and on any medium whatsoever, is prohibited without the prior written authorization of Mettrik AI.",
    s4_title: "4. Hyperlinks",
    s4_p1: "The website may contain hyperlinks to other websites. Mettrik AI exercises no control over the content of such third-party websites and cannot be held responsible for their content, operation, or use by visitors.",
    s5_title: "5. Limitation of Liability",
    s5_p1_a: "Mettrik AI provides KPI analyses of listed companies",
    s5_p1_b: "for informational purposes only",
    s5_p1_c: ". The content presented",
    s5_p1_d: "does not constitute investment advice",
    s5_p1_e: ", nor a recommendation to buy or sell financial instruments. Past performance is not indicative of future results. Any investment decision based on the content of the website is the sole responsibility of the user.",
    s5_p2: "Mettrik AI endeavors to ensure the accuracy of the information disseminated, but cannot guarantee the accuracy, precision or completeness of the information made available on the website. Mettrik AI cannot be held liable in the event of any error or omission.",
    s6_title: "6. Governing Law and Jurisdiction",
    s6_p1: "This legal notice is governed by Swiss law. Any dispute relating to its interpretation or performance shall fall within the jurisdiction of the ordinary courts of the operator's seat (Kreuzlingen, Thurgau), subject to mandatory consumer-protection provisions.",
  },
};

export default async function MentionsPage() {
  const rawLocale = await getServerLocale();
  const locale: "fr" | "en" = rawLocale === "fr" ? "fr" : "en";
  const t = locale === "fr" ? STR.fr : STR.en;

  return (
    <LegalLayout title={t.title} updatedAt={t.updatedAt} locale={locale}>
      <p>
        {t.intro_1} <strong>{t.intro_site}</strong> {t.intro_2}
      </p>

      <LegalSection title={t.s1_title}>
        <p>
          {t.s1_p1_a} <strong>{t.s1_p1_b}</strong> {t.s1_p1_c} <strong>{t.s1_p1_addr}</strong>{t.s1_p1_d}
        </p>
        <p>
          <strong>{t.s1_contact_label}</strong>{" "}
          <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline">contact@mettrik.ai</a>
        </p>
        <p>
          <strong>{t.s1_siren_label}</strong> {t.s1_siren_value}
        </p>
        <p>
          <strong>{t.s1_tva_label}</strong> {t.s1_tva_value}
        </p>
        <p>
          <strong>{t.s1_pub_label}</strong> {t.s1_pub_value}
        </p>
      </LegalSection>

      <LegalSection title={t.s2_title}>
        <p>
          {t.s2_p1_a} <strong>{t.s2_p1_b}</strong>{t.s2_p1_c}{" "}
          <a href="https://vercel.com" className="text-violet-300 hover:underline">vercel.com</a>
        </p>
        <p>
          {t.s2_p2_a} <strong>{t.s2_p2_b}</strong> {t.s2_p2_c}{" "}
          <ToFill>{t.s2_p2_tofill}</ToFill>
          {t.s2_p2_d}
        </p>
      </LegalSection>

      <LegalSection title={t.s3_title}>
        <p>{t.s3_p1}</p>
        <p>{t.s3_p2}</p>
      </LegalSection>

      <LegalSection title={t.s4_title}>
        <p>{t.s4_p1}</p>
      </LegalSection>

      <LegalSection title={t.s5_title}>
        <p>
          {t.s5_p1_a} <strong>{t.s5_p1_b}</strong>{t.s5_p1_c}{" "}
          <strong>{t.s5_p1_d}</strong>{t.s5_p1_e}
        </p>
        <p>{t.s5_p2}</p>
      </LegalSection>

      <LegalSection title={t.s6_title}>
        <p>{t.s6_p1}</p>
      </LegalSection>
    </LegalLayout>
  );
}
