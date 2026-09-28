const setupSteps = [
  'Add your properties and rooms',
  'Register customers and create bookings',
  'Record payments and review invoices',
];

export default function HomePage() {
  return (
    <main data-surface="public" className="hero relative flex min-h-screen w-full flex-col overflow-hidden px-6 py-12 sm:px-10 sm:py-20">
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-6xl flex-col">
      <header className="flex items-center justify-between gap-4">
        <a className="text-sm font-bold tracking-[0.18em] text-[#F1E9D6]" href="/">
          STAYWISE
        </a>
        <span className="rounded-full border border-white/25 bg-black/15 px-4 py-2 text-xs font-medium text-white/85">
          Hotel, short-let &amp; apartment operations
        </span>
      </header>

      <section className="grid flex-1 items-center gap-12 py-16 md:grid-cols-[1.2fr_0.8fr] md:py-24">
        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-[#F1E9D6]">
            Your operations, in one place
          </p>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.08] tracking-tight text-[#F7F3E8] sm:text-6xl">
            Make every stay easier to manage.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/80">
            Keep rooms, reservations, customers, and payments organized from arrival to checkout.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              className="pill pill--solid rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white"
              href="/login"
            >
              Sign in
            </a>
            <a
              className="pill pill--outline rounded-full border border-white/40 bg-black/10 px-6 py-3 text-sm font-semibold text-white"
              href="/properties"
            >
              Manage properties
            </a>
            <a
              className="pill pill--outline rounded-full border border-white/40 bg-black/10 px-6 py-3 text-sm font-semibold text-white"
              href="/customers"
            >
              Customers
            </a>
            <a className="pill pill--outline rounded-full border border-white/40 bg-black/10 px-6 py-3 text-sm font-semibold text-white" href="/products">Products &amp; services</a>
            <a className="pill pill--outline rounded-full border border-white/40 bg-black/10 px-6 py-3 text-sm font-semibold text-white" href="/inventory">Inventory</a>
            <a className="pill pill--outline rounded-full border border-white/40 bg-black/10 px-6 py-3 text-sm font-semibold text-white" href="/sales">Sales</a>
            <a className="pill pill--outline rounded-full border border-white/40 bg-black/10 px-6 py-3 text-sm font-semibold text-white" href="/dashboard">Dashboard</a>
            <a className="pill pill--outline rounded-full border border-white/40 bg-black/10 px-6 py-3 text-sm font-semibold text-white" href="/expenses">Expenses</a>
            <span className="rounded-full border border-white/25 px-6 py-3 text-sm font-medium text-white/75">
              Local setup preview
            </span>
          </div>
        </div>

        <aside className="rounded-3xl border border-white/25 bg-[#17231e]/80 p-7 text-white shadow-sm backdrop-blur-md sm:p-9">
          <p className="text-sm font-semibold text-accent">A clear daily rhythm</p>
          <h2 className="mt-3 text-2xl font-semibold">From room to revenue</h2>
          <ol className="mt-8 space-y-5">
            {setupSteps.map((step, index) => (
              <li className="flex gap-4" key={step}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper text-sm font-semibold text-accent">
                  {index + 1}
                </span>
                <span className="pt-1 text-sm leading-6 text-white/80">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-8 border-t border-ink/10 pt-6 text-xs leading-5 text-ink/55">
            The reservation-to-cash workflow is being delivered milestone by milestone.
          </div>
        </aside>
      </section>

      <footer className="border-t border-white/25 pt-5 text-xs text-white/70">
        Staywise · Hotel, Short-let &amp; Apartment Business Manager
      </footer>
      </div>
    </main>
  );
}
