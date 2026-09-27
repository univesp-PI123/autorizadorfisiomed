// Avisos da importação agrupados por tipo, com as linhas da planilha em que
// aparecem — o relatório mostra "12 linhas: CPF inválido (linhas 4, 9, …)".

export type Aviso = { mensagem: string; quantidade: number; linhas: number[] };

const MAX_LINHAS_LISTADAS = 20;

export class Avisos {
  private grupos = new Map<string, Aviso>();

  add(mensagem: string, linha: number) {
    const g = this.grupos.get(mensagem) ?? { mensagem, quantidade: 0, linhas: [] };
    g.quantidade++;
    if (g.linhas.length < MAX_LINHAS_LISTADAS) g.linhas.push(linha);
    this.grupos.set(mensagem, g);
  }

  lista(): Aviso[] {
    return [...this.grupos.values()].sort((a, b) => b.quantidade - a.quantidade);
  }
}
