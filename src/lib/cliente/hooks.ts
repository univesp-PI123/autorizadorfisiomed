"use client";

import { useCallback, useEffect, useState } from "react";
import { mensagemDeErro } from "./api";

type Resultado<T> = {
  buscar: () => Promise<T>; // busca que produziu este resultado
  versao: number;
  data: T | null;
  erro: string | null;
};

/**
 * Busca dados ao montar e sempre que `buscar` mudar. `buscar` precisa ser
 * estável entre renderizações (um método de serviço ou um useCallback),
 * senão a busca se repete a cada render.
 */
export function useFetch<T>(buscar: () => Promise<T>) {
  const [versao, setVersao] = useState(0);
  const [resultado, setResultado] = useState<Resultado<T> | null>(null);

  useEffect(() => {
    let ativo = true; // ignora respostas de buscas que já foram substituídas
    buscar().then(
      (data) => ativo && setResultado({ buscar, versao, data, erro: null }),
      (erro) =>
        ativo &&
        setResultado((r) => ({
          buscar,
          versao,
          data: r?.data ?? null,
          erro: mensagemDeErro(erro, "Erro desconhecido."),
        })),
    );
    return () => {
      ativo = false;
    };
  }, [buscar, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  // Carregando = o resultado guardado ainda não é o da busca atual.
  const carregando = !resultado || resultado.buscar !== buscar || resultado.versao !== versao;

  return {
    data: resultado?.data ?? null,
    erro: carregando ? null : resultado.erro,
    carregando,
    recarregar,
  };
}

/** Página atual de uma tabela paginada (o total vem da resposta da API). */
export function usePaginacao(limite = 20) {
  const [pagina, setPagina] = useState(1);
  const resetar = useCallback(() => setPagina(1), []);
  return { pagina, limite, setPagina, resetar };
}
