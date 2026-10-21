import { requireRole } from '../middleware/auth';

describe('requireRole middleware', () => {
  const run = (role: string, ...allowed: string[]) => {
    const next = jest.fn();
    requireRole(...allowed)({ user: { role } } as never, {} as never, next);
    return next;
  };
  it('maps the legacy ADMIN policy to business OWNER membership', () => {
    expect(run('OWNER', 'ADMIN')).toHaveBeenCalledWith(undefined);
    expect(run('STAFF', 'ADMIN').mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });
  it('supports explicit membership roles', () => {
    expect(run('MANAGER', 'MANAGER')).toHaveBeenCalledWith(undefined);
    expect(run('STAFF', 'MANAGER').mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });
});
