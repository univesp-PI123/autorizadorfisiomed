// Preferências de acessibilidade de cada navegador (guardadas no
// localStorage). Viram atributos no <html>, que o CSS usa (app.css,
// "Acessibilidade"); um script no <head> as aplica antes da pintura.

export const CHAVE_ACESSIBILIDADE = "sga-acessibilidade";

export const TAMANHOS_TEXTO = [100, 112, 125, 150] as const;
export type TamanhoTexto = (typeof TAMANHOS_TEXTO)[number];

export type Preferencias = {
  texto: TamanhoTexto; // % de ampliação da interface
  contraste: boolean; // alto contraste
  links: boolean; // sublinhar links
  movimento: boolean; // reduzir animações
  libras: boolean; // tradutor VLibras
};

export const PADRAO: Preferencias = { texto: 100, contraste: false, links: false, movimento: false, libras: false };

export function lerPreferencias(): Preferencias {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_ACESSIBILIDADE) ?? "{}");
    return {
      texto: TAMANHOS_TEXTO.includes(salvo.texto) ? salvo.texto : PADRAO.texto,
      contraste: salvo.contraste === true,
      links: salvo.links === true,
      movimento: salvo.movimento === true,
      libras: salvo.libras === true,
    };
  } catch {
    return PADRAO;
  }
}

/** Aplica ao <html>. Espelha o script do <head> (SCRIPT_ACESSIBILIDADE). */
export function aplicarPreferencias(p: Preferencias) {
  const html = document.documentElement;
  html.dataset.texto = String(p.texto);
  html.style.setProperty("--zoom", String(p.texto / 100));
  html.style.zoom = String(p.texto / 100);
  html.toggleAttribute("data-contraste", p.contraste);
  html.toggleAttribute("data-links", p.links);
  html.toggleAttribute("data-movimento-reduzido", p.movimento);
}

// Versão mínima do aplicarPreferencias para rodar antes do React carregar.
export const SCRIPT_ACESSIBILIDADE = `try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  CHAVE_ACESSIBILIDADE,
)})||"{}"),h=document.documentElement,t=[100,112,125,150].indexOf(p.texto)>=0?p.texto:100;h.dataset.texto=t;h.style.setProperty("--zoom",t/100);h.style.zoom=t/100;if(p.contraste===true)h.setAttribute("data-contraste","");if(p.links===true)h.setAttribute("data-links","");if(p.movimento===true)h.setAttribute("data-movimento-reduzido","")}catch(e){}`;

// Pequeno "store" para as telas reagirem às mudanças (useSyncExternalStore).
const ouvintes = new Set<() => void>();
let cache: Preferencias | null = null;

export const lojaAcessibilidade = {
  assinar(ouvinte: () => void) {
    ouvintes.add(ouvinte);
    return () => ouvintes.delete(ouvinte);
  },
  atual(): Preferencias {
    return (cache ??= lerPreferencias());
  },
  servidor(): Preferencias {
    return PADRAO;
  },
  salvar(p: Preferencias) {
    cache = p;
    try {
      localStorage.setItem(CHAVE_ACESSIBILIDADE, JSON.stringify(p));
    } catch {
      // sem armazenamento: vale só nesta visita
    }
    aplicarPreferencias(p);
    ouvintes.forEach((o) => o());
  },
};
