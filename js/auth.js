'use strict';

/**
 * Module d'authentification admin.
 * Utilise Web Crypto API (SHA-256) pour comparer le mot de passe
 * sans jamais stocker la valeur en clair.
 */
const Auth = (() => {

  const SESSION_KEY = 'lc_auth';

  // ── Hash SHA-256 ──────────────────────────────────────────────────────────

  /**
   * Calcule le hash SHA-256 d'une chaîne et le retourne en hexadécimal.
   * @param {string} str
   * @returns {Promise<string>}
   */
  async function hashPassword(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Vérifie si le mot de passe fourni correspond au hash stocké.
   * @param {string} password  Mot de passe en clair
   * @param {string} hash      Hash hexadécimal SHA-256 attendu
   * @returns {Promise<boolean>}
   */
  async function verifyPassword(password, hash) {
    const computed = await hashPassword(password);
    return computed === hash;
  }

  // ── Session ───────────────────────────────────────────────────────────────

  /**
   * Démarre la session admin en stockant le hash du mot de passe en sessionStorage.
   * Ce hash sert à la fois de jeton de session et de token d'API pour les écritures.
   * La session est effacée automatiquement à la fermeture de l'onglet.
   * @param {string} passwordHash  Hash SHA-256 du mot de passe admin
   */
  function login(passwordHash) {
    sessionStorage.setItem(SESSION_KEY, passwordHash);
  }

  /** Efface la session admin. */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  /** @returns {boolean} Vrai si une session admin est active */
  function isLoggedIn() {
    return !!sessionStorage.getItem(SESSION_KEY);
  }

  /**
   * Retourne le token de session (hash SHA-256 du mot de passe) utilisé pour
   * authentifier les requêtes d'écriture vers Apps Script.
   * @returns {string|null}
   */
  function getToken() {
    return sessionStorage.getItem(SESSION_KEY);
  }

  return { hashPassword, verifyPassword, login, logout, isLoggedIn, getToken };
})();
