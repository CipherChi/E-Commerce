const setupSteps = [
  'Add your properties and rooms',
  'Register guests and create bookings',
  'Record payments and review invoices',
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-12 sm:px-10 sm:py-20">
      <header className="flex items-center justify-between gap-4">
        <a className="text-sm font-bold tracking-[0.18em] text-accent" href="/">
          STAYWISE
        </a>
        <span className="rounded-full border border-ink/10 px-4 py-2 text-xs font-medium text-ink/70">
          Hotel &amp; short-let operations
        </span>
      </header>

      <section className="grid flex-1 items-center gap-12 py-16 md:grid-cols-[1.2fr_0.8fr] md:py-24">
        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Your operations, in one place
          </p>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Make every stay easier to manage.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-ink/70">
            Keep rooms, reservations, guests, and payments organized from arrival to checkout.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <span className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white">
              Login arrives in M1
            </span>
            <span className="rounded-full border border-ink/15 px-6 py-3 text-sm font-medium text-ink/70">
              Local setup preview
            </span>
          </div>
        </div>

        <aside className="rounded-3xl border border-ink/10 bg-white/70 p-7 shadow-sm sm:p-9">
          <p className="text-sm font-semibold text-accent">A clear daily rhythm</p>
          <h2 className="mt-3 text-2xl font-semibold">From room to revenue</h2>
          <ol className="mt-8 space-y-5">
            {setupSteps.map((step, index) => (
              <li className="flex gap-4" key={step}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper text-sm font-semibold text-accent">
                  {index + 1}
                </span>
                <span className="pt-1 text-sm leading-6 text-ink/75">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-8 border-t border-ink/10 pt-6 text-xs leading-5 text-ink/55">
            The reservation-to-cash workflow is being delivered milestone by milestone.
          </div>
        </aside>
      </section>

      <footer className="border-t border-ink/10 pt-5 text-xs text-ink/50">
        Staywise · Hotel / Short-let Business Manager
      </footer>
    </main>
  );
}
