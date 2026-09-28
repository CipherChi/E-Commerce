export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-surface="public" className="auth-surface">
      <div className="auth-content">{children}</div>
    </div>
  );
}
