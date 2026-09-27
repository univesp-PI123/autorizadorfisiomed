// Marca de texto da Fisiomed ABA, até existir o arquivo de logo da clínica.
// Para usar o logo: coloque o arquivo em public/ e troque este componente por
// <img src="/logo.svg" alt="Fisiomed ABA" />.
export default function Marca() {
  return (
    <span className="marca">
      <span className="sb-rail__mark" aria-hidden="true">
        F
      </span>
      <span className="marca__nome">Fisiomed ABA</span>
    </span>
  );
}
