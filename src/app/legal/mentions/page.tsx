import { LegalLayout, LegalSection, ToFill } from "@/components/legal/legal-layout";

export const metadata = {
  title: "Mentions légales · Mettrik AI",
  description: "Mentions légales du site Mettrik AI.",
};

export default function MentionsPage() {
  return (
    <LegalLayout title="Mentions légales" updatedAt="29 avril 2026">
      <p>
        Ces mentions légales s&apos;appliquent à l&apos;ensemble des pages publiées sur le site
        <strong> www.mettrik.ai</strong> et services associés.
      </p>

      <LegalSection title="1. Éditeur du site">
        <p>
          Le site est édité par <strong>AIRSCAPE</strong> (société d&apos;exploitation de la marque Mettrik AI),
          dont le siège social est situé : <strong>60 rue François 1er, 75008 Paris, France</strong>.
        </p>
        <p>
          <strong>Contact :</strong> <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline">contact@mettrik.ai</a>
        </p>
        <p>
          <strong>SIREN :</strong> 935 055 137
        </p>
        <p>
          <strong>Numéro de TVA intracommunautaire :</strong> FR16935055137
        </p>
        <p>
          <strong>Directeur de la publication :</strong> AIRSCAPE
        </p>
      </LegalSection>

      <LegalSection title="2. Hébergement">
        <p>
          Le site est hébergé par <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.
          Site web : <a href="https://vercel.com" className="text-violet-300 hover:underline">vercel.com</a>
        </p>
        <p>
          La base de données et l&apos;authentification sont fournies par <strong>Supabase Inc.</strong> (région d&apos;hébergement :
          <ToFill>EU West Frankfurt à confirmer après création projet prod</ToFill>).
        </p>
      </LegalSection>

      <LegalSection title="3. Propriété intellectuelle">
        <p>
          L&apos;ensemble des contenus présents sur le site (textes, graphismes, logos, icônes, images, vidéos, code source) est
          la propriété exclusive de Mettrik AI ou de ses partenaires, et est protégé par les lois en vigueur sur la propriété intellectuelle.
        </p>
        <p>
          Toute reproduction, représentation, modification, publication, transmission, dénaturation, totale ou partielle du site
          ou de son contenu, par quelque procédé que ce soit, et sur quelque support que ce soit, est interdite sans autorisation
          écrite préalable de Mettrik AI.
        </p>
      </LegalSection>

      <LegalSection title="4. Liens hypertextes">
        <p>
          Le site peut contenir des liens hypertextes pointant vers d&apos;autres sites internet. Mettrik AI n&apos;exerce aucun
          contrôle sur le contenu de ces sites tiers et ne saurait être tenu responsable de leur contenu, fonctionnement,
          ou utilisation par les visiteurs.
        </p>
      </LegalSection>

      <LegalSection title="5. Limitation de responsabilité">
        <p>
          Mettrik AI fournit des analyses de KPIs sur des sociétés cotées <strong>à titre informatif uniquement</strong>. Les contenus
          présentés <strong>ne constituent pas un conseil en investissement</strong>, ni une recommandation d&apos;achat ou de vente
          d&apos;instruments financiers. Les performances passées ne préjugent pas des performances futures. Toute décision
          d&apos;investissement basée sur les contenus du site relève de la seule responsabilité de l&apos;utilisateur.
        </p>
        <p>
          Mettrik AI s&apos;efforce d&apos;assurer l&apos;exactitude des informations diffusées, mais ne peut garantir l&apos;exactitude,
          la précision ou l&apos;exhaustivité des informations mises à disposition sur le site. La responsabilité de Mettrik AI ne
          saurait être engagée en cas d&apos;erreur ou d&apos;omission.
        </p>
      </LegalSection>

      <LegalSection title="6. Droit applicable et juridiction">
        <p>
          Les présentes mentions légales sont régies par le droit français.
          Tout litige relatif à leur interprétation ou à leur exécution relèvera de la compétence exclusive des tribunaux
          compétents de Paris.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
