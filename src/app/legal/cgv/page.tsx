import { LegalLayout, LegalSection, ToFill } from "@/components/legal/legal-layout";

export const metadata = {
  title: "Conditions générales de vente · Mettrik AI",
  description: "Conditions générales de vente des abonnements Mettrik AI.",
};

export default function CGVPage() {
  return (
    <LegalLayout title="Conditions générales de vente" updatedAt="30 avril 2026">
      <p>
        Les présentes Conditions Générales de Vente (ci-après « <strong>CGV</strong> ») régissent la souscription
        d&apos;abonnements aux services payants de Mettrik AI sur <strong>www.mettrik.ai</strong>.
      </p>

      <LegalSection title="1. Identité du vendeur">
        <p>
          Le vendeur est <strong>AIRSCAPE</strong> (exploitant la marque <strong>Mettrik AI</strong>),
          dont le siège social est situé : <strong>60 rue François 1er, 75008 Paris, France</strong>.
        </p>
        <p>
          Numéro d&apos;identification : <ToFill>SIREN/SIRET ou IDE</ToFill> · Numéro TVA : <ToFill>à compléter</ToFill> ·
          Email : <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline">contact@mettrik.ai</a>
        </p>
      </LegalSection>

      <LegalSection title="2. Offres d'abonnement">
        <p>Mettrik AI propose les abonnements suivants :</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>Free</strong> : 0 € / mois. Accès complet à 2 sociétés (Google, Meta) avec comparaison entre elles. Les autres sociétés sont accessibles avec contenus floutés.</li>
          <li><strong>Premium mensuel</strong> : 24,90 € HT / mois (ou 24,90 CHF / 29,90 USD selon devise). Accès complet à toutes les sociétés couvertes, comparaison N-vs-N, watchlists, alertes.</li>
          <li><strong>Premium annuel</strong> : 189 € HT / an (ou 189 CHF / 249 USD). Économie d&apos;environ 37 % par rapport au mensuel. Mêmes fonctionnalités que Premium mensuel.</li>
          <li><strong>Enterprise / API</strong> : sur devis. Accès API, multi-utilisateurs, support dédié.</li>
        </ul>
        <p>
          Les prix sont indiqués hors taxes. La TVA applicable (taux en vigueur dans le pays de résidence de
          l&apos;utilisateur) est ajoutée automatiquement par notre prestataire de paiement Stripe au moment du
          paiement.
        </p>
      </LegalSection>

      <LegalSection title="3. Souscription">
        <p>
          La souscription s&apos;effectue en ligne via la plateforme de paiement sécurisée <strong>Stripe</strong>.
          Mettrik AI n&apos;a accès à aucune donnée bancaire de l&apos;utilisateur ; ces données sont stockées et
          traitées exclusivement par Stripe selon les normes PCI-DSS.
        </p>
        <p>
          La souscription prend effet immédiatement après confirmation du paiement. L&apos;utilisateur reçoit une
          confirmation par email à l&apos;adresse indiquée lors de l&apos;inscription.
        </p>
      </LegalSection>

      <LegalSection title="4. Renouvellement et résiliation">
        <p>
          Les abonnements Premium se renouvellent automatiquement à la fin de chaque période (mensuelle ou annuelle).
        </p>
        <p>
          L&apos;utilisateur peut résilier son abonnement à tout moment depuis son espace personnel ou en contactant
          <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline"> contact@mettrik.ai</a>.
          La résiliation prend effet à la fin de la période en cours ; aucun remboursement au prorata n&apos;est effectué pour
          la période entamée.
        </p>
      </LegalSection>

      <LegalSection title="5. Droit de rétractation">
        <p>
          Conformément à la législation européenne sur la consommation, l&apos;utilisateur dispose d&apos;un délai de
          <strong> 14 jours </strong>à compter de la souscription pour exercer son droit de rétractation, sauf si le
          service a déjà été pleinement exécuté avec son accord exprès et renoncement explicite à ce droit.
        </p>
        <p>
          <strong>Renoncement explicite :</strong> En cliquant sur le bouton « Souscrire » lors du checkout,
          l&apos;utilisateur reconnaît expressément que le service Mettrik AI est fourni immédiatement après le paiement
          et accepte de renoncer à son droit de rétractation pour le contenu déjà consulté. Les périodes non encore
          consommées peuvent toutefois faire l&apos;objet d&apos;un remboursement au prorata sur demande motivée.
        </p>
      </LegalSection>

      <LegalSection title="6. Modifications de prix">
        <p>
          Mettrik AI se réserve le droit de modifier ses tarifs à tout moment. Toute modification de prix sera notifiée
          aux abonnés au moins 30 jours avant son entrée en vigueur, par email à l&apos;adresse associée au compte.
          L&apos;utilisateur peut résilier son abonnement avant l&apos;entrée en vigueur du nouveau tarif sans frais.
        </p>
      </LegalSection>

      <LegalSection title="7. Facturation">
        <p>
          Une facture est émise automatiquement à chaque échéance d&apos;abonnement et envoyée par email. Toutes les
          factures sont également téléchargeables depuis l&apos;espace personnel de l&apos;utilisateur.
        </p>
      </LegalSection>

      <LegalSection title="8. Responsabilité et garanties">
        <p>
          Mettrik AI s&apos;engage à fournir le service avec diligence et selon les règles de l&apos;art. Toutefois, le
          service est fourni « en l&apos;état » et Mettrik AI ne garantit ni l&apos;adéquation du service à un usage
          particulier, ni l&apos;absence d&apos;erreurs, ni la continuité ininterrompue du service.
        </p>
        <p>
          La responsabilité de Mettrik AI est expressément limitée au montant de l&apos;abonnement payé par
          l&apos;utilisateur sur les 12 derniers mois.
        </p>
      </LegalSection>

      <LegalSection title="9. Propriété intellectuelle des KPIs et des contenus générés">
        <p>
          Les contenus présentés sur Mettrik AI sont de deux natures :
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            <strong>Données primaires sources :</strong> chiffres financiers, déclarations, faits relatifs aux sociétés
            cotées analysées. Ces données sont issues de publications officielles (rapports annuels, trimestriels,
            communiqués réglementaires) et restent la propriété de leurs auteurs respectifs (les sociétés cotées
            elles-mêmes ou leurs régulateurs).
          </li>
          <li>
            <strong>Contenus générés et travaillés par Mettrik AI :</strong> méthodologies de scoring, indicateurs
            composites (Super KPIs), interprétations éditoriales, analyses comparatives, scores de qualité,
            scores de risque, classements, agrégations, visualisations, et tout autre dérivé produit par les
            traitements algorithmiques ou éditoriaux de Mettrik AI. Ces contenus sont la <strong>propriété
            exclusive de Mettrik AI</strong>, protégés par le droit d&apos;auteur, le droit des bases de données
            (article L. 341-1 et suivants du Code de la propriété intellectuelle français, et dispositions
            équivalentes en Suisse) et tout autre régime applicable.
          </li>
        </ul>
        <p>
          L&apos;abonnement confère à l&apos;utilisateur un droit d&apos;usage personnel, non exclusif et non
          transférable des contenus auxquels il a accès. Toute reproduction, redistribution, republication,
          revente, adaptation, traduction ou exploitation commerciale, totale ou partielle, des contenus
          générés par Mettrik AI est strictement interdite sans autorisation écrite préalable.
        </p>
      </LegalSection>

      <LegalSection title="10. Interdictions techniques">
        <p>
          L&apos;utilisateur s&apos;engage explicitement à ne pas :
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            <strong>Procéder à toute forme de rétro-ingénierie</strong> (« reverse engineering ») du service,
            de son code, de ses algorithmes, de ses méthodologies de scoring ou de tout composant logiciel,
            sauf dans les cas strictement autorisés par la loi (article L. 122-6-1 IV CPI en France) ;
          </li>
          <li>
            <strong>Effectuer toute extraction automatisée de données</strong> (« scraping », « crawling »,
            utilisation de robots, de scripts automatisés, de plug-ins ou d&apos;outils similaires) à partir du
            site, en dehors des éventuelles API officielles fournies par Mettrik AI ;
          </li>
          <li>
            Tenter de contourner les limites techniques (paywall, quotas, authentification, cookies, jetons,
            chiffrements) ;
          </li>
          <li>
            Décompiler, désassembler ou modifier le code source du service ;
          </li>
          <li>
            Reproduire la base de données Mettrik AI dans tout ou en partie qualitativement ou
            quantitativement substantielle, ce qui constituerait une atteinte au droit sui generis du
            producteur de la base.
          </li>
        </ul>
        <p>
          Toute violation de l&apos;une de ces interdictions entraînera la résiliation immédiate du compte
          sans remboursement, ainsi que d&apos;éventuelles poursuites judiciaires civiles et pénales.
        </p>
      </LegalSection>

      <LegalSection title="11. Avertissement investissement">
        <p>
          <strong>Le service Mettrik AI ne constitue pas un conseil en investissement.</strong> Les contenus diffusés
          (analyses, scores, comparaisons) sont fournis à titre informatif uniquement. Mettrik AI ne fournit aucune
          recommandation personnalisée d&apos;achat ou de vente d&apos;instruments financiers. Toute décision
          d&apos;investissement relève de la seule responsabilité de l&apos;utilisateur.
        </p>
      </LegalSection>

      <LegalSection title="12. Droit applicable et juridiction">
        <p>
          Les présentes CGV sont régies par le droit français. En cas de litige,
          une solution amiable sera recherchée prioritairement. À défaut, les tribunaux de
          Paris seront seuls compétents.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
