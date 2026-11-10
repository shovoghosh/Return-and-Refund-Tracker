import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth-guard";
import { LinkButton, PageHeader } from "@/components/ui";
import { SettingsForm } from "./_components/settings-form";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        subtitle="Your time zone, reminders, and data. Nothing here is shared with anyone else."
        action={
          <LinkButton href="/export" variant="secondary" size="sm">
            <Download className="size-3.5" aria-hidden="true" />
            Export data
          </LinkButton>
        }
      />
      <SettingsForm
        user={{
          email: user.email,
          timezone: user.timezone,
          reminderOffsets: user.reminderOffsets,
          reminderHour: user.reminderHour,
          emailRemindersOn: user.emailRemindersOn,
        }}
      />
    </div>
  );
}
