// Helpers compartilhados pelo módulo Dingy / Social Media para identificar
// quem pertence ao time de Social Media (Designer / Videomaker / Editor).

export function isSocialTeamMember(m: { roles?: string[] }): boolean {
  if (!m?.roles || !Array.isArray(m.roles)) return false;
  return m.roles.some((r) => (r || "").toLowerCase().startsWith("social media"));
}
