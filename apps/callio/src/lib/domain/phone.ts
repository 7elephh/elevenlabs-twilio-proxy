/**
 * Presentation des numeros de telephone.
 *
 * Les vues de liste affichent un numero masque : un tableau de prospects est
 * consulte a l'ecran, souvent devant des tiers, et le numero complet n'y est
 * jamais necessaire. Il reste lisible en entier dans la fiche detaillee, ou
 * l'utilisateur a explicitement ouvert un dossier.
 *
 * Ce masquage est une mesure de presentation, pas un controle d'acces : la
 * protection reelle des donnees repose sur la RLS.
 */

/** Retire tout sauf les chiffres, en conservant un eventuel "+" initial. */
function normalize(phone: string): { plus: boolean; digits: string } {
  const trimmed = phone.trim();
  return {
    plus: trimmed.startsWith("+"),
    digits: trimmed.replace(/\D/g, ""),
  };
}

/**
 * Decoupe un numero en trois parties : un prefixe reconnaissable, un milieu a
 * masquer, et les deux derniers chiffres.
 *
 * Le prefixe suit la lecture habituelle plutot qu'un decoupage a l'aveugle :
 * `+33 6` pour un numero francais international, `06` pour un national.
 */
function split(phone: string): { head: string; hidden: number; tail: string } | null {
  const { plus, digits } = normalize(phone);
  if (digits.length < 4) return null;

  const tail = digits.slice(-2);

  if (plus && digits.startsWith("33") && digits.length >= 5) {
    // +33 suivi du premier chiffre de l'operateur.
    return {
      head: `+33 ${digits.slice(2, 3)}`,
      hidden: digits.length - 3 - 2,
      tail,
    };
  }

  if (plus) {
    // Indicatif inconnu : on conserve deux chiffres apres le "+".
    return { head: `+${digits.slice(0, 2)}`, hidden: digits.length - 2 - 2, tail };
  }

  return { head: digits.slice(0, 2), hidden: digits.length - 2 - 2, tail };
}

/**
 * Masque un numero en ne laissant visibles qu'un prefixe et les deux derniers
 * chiffres : `+33612480091` devient `+33 6 •• •• •• 91`.
 *
 * Un numero trop court pour etre masque utilement l'est entierement.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";

  const parts = split(phone);
  if (!parts) return "••";

  const groups = Math.max(1, Math.ceil(parts.hidden / 2));
  const middle = Array.from({ length: groups }, () => "••").join(" ");
  return `${parts.head} ${middle} ${parts.tail}`;
}

/** Mise en forme lisible d'un numero francais, sans masquage. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";

  const { plus, digits } = normalize(phone);

  if (plus && digits.startsWith("33") && digits.length === 11) {
    const n = digits.slice(2);
    return `+33 ${n.slice(0, 1)} ${n.slice(1, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
  }
  if (!plus && digits.length === 10) {
    return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  return phone;
}
