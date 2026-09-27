import Image from "next/image";

// Logos da Fisiomed ABA (public/marca):
// - logo-fisiomed.png          horizontal colorido (fundos claros)
// - logo-fisiomed-branco.webp  empilhado branco (fundos escuros)
// - logo-simbolo.png           só o "O" de quebra-cabeça (espaços quadrados)
// O CSS (app.css, "Logos") mostra a versão certa para o tema e para o menu.

const NOME = "Fisiomed ABA";

/** Logo do cartão de login: colorido no tema claro, branco no escuro. É o
 * título principal (h1) da tela, lido como "Fisiomed ABA". */
export function LogoLogin() {
  return (
    <h1 className="logo-login">
      <Image className="logo--claro" src="/marca/logo-fisiomed.png" alt={NOME} width={240} height={70} priority unoptimized />
      <Image className="logo--escuro" src="/marca/logo-fisiomed-branco.webp" alt={NOME} width={120} height={110} priority unoptimized />
    </h1>
  );
}

/** Logo da barra lateral: símbolo com o menu recolhido, logo inteiro expandido. */
export function LogoMenu() {
  return (
    <span className="logo-menu">
      <Image className="logo-menu__simbolo" src="/marca/logo-simbolo.png" alt={NOME} width={32} height={32} priority unoptimized />
      <Image className="logo-menu__inteiro" src="/marca/logo-fisiomed.png" alt={NOME} width={137} height={40} priority unoptimized />
    </span>
  );
}
