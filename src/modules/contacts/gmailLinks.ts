import { openUrl } from "@tauri-apps/plugin-opener";

/** Gmail új levél, a címzett előre kitöltve. Account-agnosztikus (nincs /u/N), hogy a
 * böngésző aktív Google-fiókja döntsön. */
export function composeUrl(email: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
}

/** Gmail keresés a személy e-mail-címére (a rá vonatkozó levelezés). */
export function searchUrl(email: string): string {
  return `https://mail.google.com/mail/#search/${encodeURIComponent(email)}`;
}

/** Új levél megnyitása a rendszer default böngészőjében. */
export const openGmailCompose = (email: string) => openUrl(composeUrl(email));

/** Gmail keresés megnyitása a rendszer default böngészőjében. */
export const openGmailSearch = (email: string) => openUrl(searchUrl(email));
