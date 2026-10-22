import { NotBuiltYet } from "../../components/NotBuiltYet";

export default function SettingsPage() {
  return (
    <NotBuiltYet title="Settings" milestone="Milestone M5">
      Members and roles, SSO and directory sync, per-tenant branding, the development LRS target,
      and the append-only audit log. Every sensitive operation here writes an audit entry.
    </NotBuiltYet>
  );
}
