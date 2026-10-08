"use client";

/**
 * 8 oct 2026 (audit des fuites publiques, ligne 12) : le panneau admin
 * (niveaux, simulation d offre, versions) etait inclus dans le JS commun de
 * toutes les pages de mettrik.ai, meme s il ne s y affichait pas. Il n est
 * plus charge que hors du domaine public, par import dynamique.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Panneau = dynamic(() => import("./admin-floating-panel").then((m) => m.AdminFloatingPanel), { ssr: false });

export function AdminFloatingPanelLoader() {
  const [actif, setActif] = useState(false);
  useEffect(() => {
    const h = window.location.hostname.toLowerCase();
    setActif(h !== "mettrik.ai" && h !== "www.mettrik.ai");
  }, []);
  return actif ? <Panneau /> : null;
}
