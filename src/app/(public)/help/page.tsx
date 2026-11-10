import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Help — Return Tracker",
  description: "How to track a purchase, set reminders, record a return, and confirm a refund.",
};

const QUESTIONS = [
  {
    question: "How do I add a purchase?",
    answer: (
      <>
        Sign in and choose <strong>Add purchase</strong>. Enter the item name and the store&apos;s
        stated return-by date — those are the only required fields. Order number, amount, currency,
        item URL, and notes are optional. Save, and the item appears on your dashboard in deadline
        order.
      </>
    ),
  },
  {
    question: "Where does the return-by date come from?",
    answer: (
      <>
        You enter it yourself, from the store&apos;s receipt or policy page. The app never guesses a
        store&apos;s return window, never reads your inbox, and never contacts the store for you. If
        you are not sure of the date, check the store&apos;s policy before adding the item.
      </>
    ),
  },
  {
    question: "When will I be reminded?",
    answer: (
      <>
        By default you get an email 7 days, 2 days, and 1 day before the deadline. You can change
        which offsets are used, the hour reminders go out, and the time zone they follow in{" "}
        <Link href="/settings" className="font-medium text-accent underline-offset-4 hover:underline">
          Settings
        </Link>
        . Reminders are sent once per offset per item, so you will not get the same reminder twice.
      </>
    ),
  },
  {
    question: "Why have I not received a reminder email?",
    answer: (
      <>
        Check that you verified your email address, that email reminders are switched on in
        Settings, and that the reminder time has passed in your chosen time zone. In local
        development no real email is sent: verification and reminder messages are printed to the
        server console instead. If the address is still unverified, reminders are held rather than
        discarded, so they can go out once you verify.
      </>
    ),
  },
  {
    question: "How do I record a return and a refund?",
    answer: (
      <>
        Open the purchase and use the status controls to move it from open to return started,
        returned, and refund pending. The date is recorded automatically when you change status, and
        you can edit it. When the money actually arrives, mark the item as refund received and enter
        the amount. Only you can confirm that — the app will not claim a refund landed.
      </>
    ),
  },
  {
    question: "Can I attach a receipt or photo?",
    answer: (
      <>
        Yes. On the purchase page you can upload a receipt image or PDF (up to the size limit shown).
        Files are stored privately and are only served back to your own signed-in account. You can
        download or delete them at any time.
      </>
    ),
  },
  {
    question: "How do I get my data out, or delete it?",
    answer: (
      <>
        Settings has an export button that produces a CSV or JSON copy of everything you entered. It
        also has account deletion: deleting removes your purchases, reminders, and uploaded files.
        See the{" "}
        <Link href="/privacy" className="font-medium text-accent underline-offset-4 hover:underline">
          privacy page
        </Link>{" "}
        for the full picture.
      </>
    ),
  },
  {
    question: "I found a bug. Where do I report it?",
    answer: (
      <>
        Use the{" "}
        <Link href="/contact" className="font-medium text-accent underline-offset-4 hover:underline">
          contact page
        </Link>{" "}
        and include what you were doing, what you expected, and what happened. Please do not send
        passwords or full card numbers.
      </>
    ),
  },
];

export default function HelpPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        eyebrow="Support"
        title="Help"
        subtitle="Short answers about adding items, reminders, returns, refunds, and your data."
      />

      <div className="flex flex-col gap-3">
        {QUESTIONS.map(({ question, answer }) => (
          <details key={question} className="card group overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-[0.95rem] font-medium transition hover:bg-surface-2/50 sm:p-5 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2.5">
                <LifeBuoy className="size-4 shrink-0 text-accent" aria-hidden="true" />
                {question}
              </span>
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-muted transition-transform duration-200 group-open:rotate-45">
                <Plus className="size-3.5" aria-hidden="true" />
              </span>
            </summary>
            <div className="px-4 pb-4 pl-[2.85rem] text-sm leading-relaxed text-muted sm:px-5 sm:pb-5 sm:pl-[3.1rem]">
              {answer}
            </div>
          </details>
        ))}
      </div>

      <p className="text-sm text-muted">
        Still stuck?{" "}
        <Link href="/contact" className="font-medium text-foreground underline underline-offset-2">
          Contact support
        </Link>
        .
      </p>
    </div>
  );
}
