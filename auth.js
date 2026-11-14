/* SPDX-License-Identifier: MIT — OndaLibre
 * Optional Google Identity Services (GIS) sign-in for profile display ONLY.
 * This static page has no backend; a decoded ID token is not a verified
 * authorization session. Never use this state to grant privileged access.
 * A backend must verify token signature, audience, issuer and expiry before
 * using Google identity for accounts, cloud sync or protected features.
 *
 * No Google requests until the listener opens the account panel.
 * Tokens and profile data are kept in memory, not localStorage or cookies.
 */
(() => {
  "use strict";

  const panel = document.getElementById("authDetails");
  const summary = document.getElementById("authSummary");
  const buttonHost = document.getElementById("googleButton");
  const userPanel = document.getElementById("authUser");
  const nameEl = document.getElementById("authName");
  const emailEl = document.getElementById("authEmail");
  const signOut = document.getElementById("authSignOut");
  const status = document.getElementById("authStatus");

  const clientId = String(window.ONDA_GOOGLE_CLIENT_ID || "").trim();
  const configured = /^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId);
  let libraryLoading = false;
  let initialized = false;
  let profile = null;

  function message(value) { status.textContent = value; }

  function renderAccount() {
    if (!profile) {
      userPanel.hidden = true;
      buttonHost.hidden = false;
      summary.textContent = "Iniciar sesión";
      summary.setAttribute("aria-label", "Cuenta: iniciar sesión con Google");
      return;
    }
    const name = profile.name || profile.email || "Cuenta de Google";
    nameEl.textContent = name;
    emailEl.textContent = profile.email || "";
    summary.textContent = name;
    summary.setAttribute("aria-label", "Cuenta de Google: " + name);
    userPanel.hidden = false;
    buttonHost.hidden = true;
    message("Perfil visible solo en esta pestaña. No sincroniza favoritas.");
  }

  // The payload is used only to personalize the UI. Decoding a JWT in the
  // browser is NOT cryptographic verification of a Google identity.
  function decodePayload(jwt) {
    try {
      const parts = String(jwt).split(".");
      if (parts.length !== 3) return null;
      const part = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const bytes = Uint8Array.from(atob(part.padEnd(Math.ceil(part.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch { return null; }
  }

  function receiveCredential(response) {
    const claims = decodePayload(response && response.credential);
    if (!claims ||
        claims.aud !== clientId ||
        !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss) ||
        !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() ||
        typeof claims.sub !== "string" || !claims.sub) {
      message("No se pudo leer la respuesta de Google. Inténtalo de nuevo.");
      return;
    }
    // Not a server-authenticated session. Do not store JWT or Google IDs.
    profile = {
      name: typeof claims.name === "string" ? claims.name : "",
      email: typeof claims.email === "string" ? claims.email : ""
    };
    renderAccount();
  }

  function renderGoogleButton() {
    if (!window.google || !google.accounts || !google.accounts.id) {
      message("No se pudo cargar Google Identity Services.");
      return;
    }
    if (!initialized) {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: receiveCredential,
        ux_mode: "popup",
        auto_select: false
      });
      initialized = true;
    }
    buttonHost.replaceChildren();
    google.accounts.id.renderButton(buttonHost, {
      type: "standard", theme: "outline", size: "large", shape: "rectangular",
      text: "signin_with", width: 230, locale: "es"
    });
    message("Google gestiona el acceso. OndaLibre no guarda tus credenciales.");
  }

  function openGoogle() {
    if (profile) return;
    if (!configured) {
      message("El acceso con Google está pendiente de configurar el ID de cliente. Consulta el README del proyecto.");
      return;
    }
    if (window.google && google.accounts && google.accounts.id) {
      renderGoogleButton();
      return;
    }
    if (libraryLoading) return;
    libraryLoading = true;
    message("Cargando acceso con Google…");
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client?hl=es";
    script.async = true;
    script.onload = () => { libraryLoading = false; renderGoogleButton(); };
    script.onerror = () => { libraryLoading = false; script.remove(); message("No se pudo cargar Google. Comprueba la conexión y los bloqueadores del navegador."); };
    document.head.append(script);
  }

  panel.addEventListener("toggle", () => { if (panel.open) openGoogle(); });
  signOut.addEventListener("click", () => {
    profile = null;
    if (initialized && window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    renderAccount();
    message("Has cerrado la sesión visible en OndaLibre.");
    if (panel.open) openGoogle();
  });

  // Clicking elsewhere closes the panel, but never interrupts radio playback.
  document.addEventListener("pointerdown", (event) => {
    if (panel.open && !panel.contains(event.target)) panel.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel.open) {
      panel.open = false;
      summary.focus();
    }
  });
  renderAccount();
})();
