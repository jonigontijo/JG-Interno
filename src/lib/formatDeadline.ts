const DAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatDeadline(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length < 3) return dateStr;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return dateStr;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = date.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  if (diffDays === -1) return "Ontem";

  if (diffDays >= 2 && diffDays <= 6) return DAYS_SHORT[date.getDay()];
  if (diffDays >= -6 && diffDays <= -2) return DAYS_SHORT[date.getDay()];

  const sameYear = date.getFullYear() === now.getFullYear();
  if (sameYear) return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function deadlineColor(dateStr: string | undefined | null): string {
  if (!dateStr) return "text-muted-foreground";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length < 3) return "text-muted-foreground";

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return "text-muted-foreground";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = date.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays < 0) return "text-destructive";
  if (diffDays === 0) return "text-warning";
  if (diffDays <= 2) return "text-info";
  return "text-muted-foreground";
}
