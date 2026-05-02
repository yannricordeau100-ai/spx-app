import { LegalLayout, LegalSection, ToFill } from "@/components/legal/legal-layout";

export const metadata = {
  title: "Politique de confidentialité · Mettrik AI",
  description: "Politique de confidentialité et traitement des données personnelles Mettrik AI.",
};

export default function ConfidentialitePage() {
  return (
    <LegalLayout title="Politique de confidentialité" updatedAt="29 avril 2026">
      <p>
        La présente politique de confidentialité décrit la manière dont Mettrik AI collecte, utilise, conserve et protège
        vos données personnelles dans le cadre de l&apos;utilisation du site <strong>www.mettrik.ai</strong> et de ses services.
      </p>
      <p>
        Cette politique est conforme au Règlement Général sur la Protection des Données (RGPD - Règlement UE 2016/679)
        et, le cas échéant, à la Loi fédérale suisse sur la protection des données (LPD).
      </p>

      <LegalSection title="1. Responsable du traitement">
        <p>
          Le responsable du traitement de vos données personnelles est <strong>AIRSCAPE</strong>
          (exploitant la marque <strong>Mettrik AI</strong>), siège social
          au <strong>60 rue François 1er, 75008 Paris, France</strong>.
        </p>
        <p>
          Délégué à la Protection des Données (DPO) :
          <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline"> contact@mettrik.ai</a>
        </p>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <p>Mettrik AI collecte les catégories de données suivantes :</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>Données d&apos;identification :</strong> adresse email, mot de passe (haché), nom (optionnel) lors de la création de compte ;</li>
          <li><strong>Données de connexion :</strong> dates et heures de connexion, adresse IP (anonymisée après 30 jours) ;</li>
          <li><strong>Données de paiement :</strong> traitées exclusivement par Stripe. Mettrik AI ne stocke aucune donnée bancaire (numéro de carte, CVC, etc.) ;</li>
          <li><strong>Données d&apos;usage :</strong> sociétés consultées, KPIs favoris, watchlists. Utilisées uniquement pour personnaliser votre expérience ;</li>
          <li><strong>Données techniques :</strong> navigateur, OS, résolution d&apos;écran (utilisées pour optimiser le service).</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Finalités du traitement">
        <p>Vos données sont traitées pour les finalités suivantes :</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>Fournir le service Mettrik AI (gestion du compte, accès aux contenus, personnalisation) ;</li>
          <li>Gérer la facturation et le suivi des abonnements ;</li>
          <li>Communiquer avec vous (notifications transactionnelles, support, mises à jour produit) ;</li>
          <li>Améliorer le service (analyse statistique anonymisée) ;</li>
          <li>Respecter nos obligations légales (comptabilité, fiscalité).</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Bases légales">
        <p>Le traitement de vos données repose sur les bases légales suivantes :</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>Exécution du contrat :</strong> nécessaire pour fournir le service (compte, abonnement) ;</li>
          <li><strong>Consentement :</strong> pour les communications marketing facultatives ;</li>
          <li><strong>Intérêt légitime :</strong> pour les analyses statistiques anonymisées et la sécurité du service ;</li>
          <li><strong>Obligation légale :</strong> pour la comptabilité, la fiscalité, et la lutte contre la fraude.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Sous-traitants et hébergement">
        <p>
          Pour le traitement des paiements, Mettrik AI fait appel à <strong>Stripe Payments Europe Ltd.</strong>
          (Irlande), conforme aux normes PCI-DSS Level 1 et au Règlement (UE) 2016/679 (RGPD). Stripe agit de manière
          autonome dans le traitement des données bancaires confiées par l&apos;utilisateur lors du paiement.
        </p>
        <p>
          Pour les autres traitements techniques (hébergement, base de données, envoi d&apos;emails transactionnels,
          analytics anonymes), Mettrik AI fait appel à des sous-traitants sélectionnés selon les critères de
          l&apos;article 28 du RGPD : engagements contractuels, garanties de sécurité (chiffrement au repos et en
          transit, audits SOC 2, certifications ISO 27001 ou équivalentes), localisation préférentielle des données
          dans l&apos;Espace Économique Européen.
        </p>
        <p>
          La liste détaillée des sous-traitants techniques, avec leur rôle, leur base juridique et les garanties
          associées, est disponible sur demande écrite à
          <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline"> contact@mettrik.ai</a>.
          Les éventuels transferts hors UE sont encadrés par des Clauses Contractuelles Types approuvées par la
          Commission européenne ou par des décisions d&apos;adéquation en vigueur.
        </p>
      </LegalSection>

      <LegalSection title="6. Durée de conservation">
        <p>Vos données sont conservées :</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>Données de compte actif :</strong> tant que le compte est actif, puis 30 jours après suppression ;</li>
          <li><strong>Données de facturation :</strong> 10 ans (obligation légale comptable) ;</li>
          <li><strong>Données de connexion :</strong> 1 an maximum, puis anonymisation ;</li>
          <li><strong>Logs techniques :</strong> 90 jours.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Vos droits">
        <p>Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li><strong>Droit d&apos;accès :</strong> obtenir une copie des données vous concernant ;</li>
          <li><strong>Droit de rectification :</strong> corriger des données inexactes ;</li>
          <li><strong>Droit à l&apos;effacement</strong> (« droit à l&apos;oubli ») : demander la suppression de vos données ;</li>
          <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré ;</li>
          <li><strong>Droit d&apos;opposition :</strong> vous opposer au traitement pour motif légitime ;</li>
          <li><strong>Droit à la limitation :</strong> demander la limitation du traitement ;</li>
          <li><strong>Droit de retirer votre consentement :</strong> à tout moment pour les traitements basés sur le consentement.</li>
        </ul>
        <p>
          Pour exercer ces droits, contactez : <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:underline">contact@mettrik.ai</a>.
          Mettrik AI vous répondra dans un délai maximum de 30 jours.
        </p>
        <p>
          Vous disposez également du droit d&apos;introduire une réclamation auprès de la Commission Nationale de
          l&apos;Informatique et des Libertés (CNIL, <a href="https://www.cnil.fr" className="text-violet-300 hover:underline">www.cnil.fr</a>) en France,
          ou du Préposé fédéral à la protection des données (<a href="https://www.edoeb.admin.ch" className="text-violet-300 hover:underline">www.edoeb.admin.ch</a>) en Suisse.
        </p>
      </LegalSection>

      <LegalSection title="8. Cookies et traceurs">
        <p>
          Mettrik AI utilise un nombre minimal de cookies, strictement nécessaires au fonctionnement du service
          (cookies de session, cookies d&apos;authentification). Aucun cookie publicitaire ou de profilage n&apos;est utilisé.
        </p>
        <p>
          Pour les statistiques d&apos;audience, Mettrik AI utilise <strong>Plausible Analytics</strong>
          (à confirmer), un service privacy-first qui ne dépose aucun cookie et n&apos;identifie pas les visiteurs
          individuellement. Aucun consentement n&apos;est donc requis pour les statistiques.
        </p>
      </LegalSection>

      <LegalSection title="9. Sécurité">
        <p>
          Mettrik AI met en œuvre les mesures techniques et organisationnelles appropriées pour protéger vos données
          contre l&apos;accès, la modification, la divulgation ou la destruction non autorisés : chiffrement HTTPS,
          authentification sécurisée (mots de passe hachés bcrypt), accès restreint aux bases de données, audits réguliers.
        </p>
      </LegalSection>

      <LegalSection title="10. Modifications">
        <p>
          La présente politique peut être modifiée. Toute modification substantielle sera notifiée par email aux
          utilisateurs avec un compte actif au moins 30 jours avant son entrée en vigueur.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
