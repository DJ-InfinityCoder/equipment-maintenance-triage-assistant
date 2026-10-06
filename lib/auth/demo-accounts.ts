export const DEMO_ACCOUNTS = [
  {
    name: "Demo Reporter",
    email: "reporter.demo@example.com",
    password: "ReporterDemo123!",
    role: "reporter",
  },
  {
    name: "Demo Technician",
    email: "technician.demo@example.com",
    password: "TechnicianDemo123!",
    role: "technician",
  },
] as const;

export function areDemoAccountsEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}
