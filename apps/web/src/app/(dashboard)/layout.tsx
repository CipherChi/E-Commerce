export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-surface="app" className="dashboard-surface">
      <div className="dashboard-content">{children}</div>
    </div>
  );
}
