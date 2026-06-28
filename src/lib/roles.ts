export type Role = "ceo" | "sales_manager" | "account_manager" | "editor";

export const ROLE_LABEL: Record<Role, string> = {
  ceo: "CEO",
  sales_manager: "Sales Manager",
  account_manager: "Account Manager",
  editor: "Video / Content Editor",
};

// which nav items each role can see
export const NAV_ACCESS: Record<string, Role[]> = {
  dashboard: ["ceo", "sales_manager", "account_manager", "editor"],
  crm:       ["ceo", "sales_manager"],
  clients:   ["ceo", "sales_manager", "account_manager", "editor"],
  tasks:     ["ceo", "account_manager", "editor"],
  payments:  ["ceo", "sales_manager"],
  finance:   ["ceo", "sales_manager"],
  team:      ["ceo"],
};

export function can(role: Role | null, key: string): boolean {
  if (!role) return false;
  return (NAV_ACCESS[key] || []).includes(role);
}
