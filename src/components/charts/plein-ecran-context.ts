"use client";

import { createContext, useContext } from "react";

/** Vrai quand un graphique est rendu dans la vue agrandie mobile (ChartFullscreen). */
export const PleinEcranContext = createContext(false);
export const usePleinEcran = () => useContext(PleinEcranContext);
