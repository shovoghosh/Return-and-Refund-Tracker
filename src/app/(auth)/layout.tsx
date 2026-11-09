export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-4">
      <p className="text-center text-lg font-semibold tracking-tight">Return Tracker</p>
      {children}
    </div>
  );
}
