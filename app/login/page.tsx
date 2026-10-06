import LoginForm from "./LoginForm";
import { areDemoAccountsEnabled, DEMO_ACCOUNTS } from "@/lib/auth/demo-accounts";

export default function LoginPage() {
  const demoAccounts = areDemoAccountsEnabled()
    ? DEMO_ACCOUNTS.map(({ name, email, password, role }) => ({
        name,
        email,
        password,
        role,
      }))
    : [];

  return <LoginForm demoAccounts={demoAccounts} />;
}
