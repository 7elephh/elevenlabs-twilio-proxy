import { createHash, createHmac } from "node:crypto";

/**
 * Jeton secret permettant au client de consulter / annuler son rendez-vous.
 * Dérivé de l'identifiant par HMAC : il peut être recalculé pour chaque email
 * (confirmation, rappel, modification) sans jamais être stocké en clair.
 * Seul son hash SHA-256 est enregistré pour la recherche.
 */
export function manageTokenFor(bookingId: string, secret: string): string {
  if (secret.length < 32) throw new Error("MANAGE_TOKEN_SECRET doit contenir au moins 32 caractères.");
  return createHmac("sha256", secret).update(`booking:${bookingId}`).digest("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
