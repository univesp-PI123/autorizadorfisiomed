"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";

// Registra uma vez os elementos do Chart.js usados nas telas.
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export const CORES = {
  azul: "#2563eb",
  verde: "#16a34a",
  laranja: "#d97706",
  vermelho: "#dc2626",
};

/** Mesma cor com transparência (sufixo alfa em hexadecimal). */
export const translucida = (cor: string) => `${cor}99`;
