import { swaggerBasicAuth } from './swagger-basic-auth';

describe('swaggerBasicAuth', () => {
  it('rejects requests without valid credentials and challenges for Basic auth', () => {
    const req: any = { headers: {} };
    const res: any = { setHeader: jest.fn(), sendStatus: jest.fn() };
    const next = jest.fn();
    swaggerBasicAuth('docs', 'secret')(req, res, next);
    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="API documentation"');
    expect(next).not.toHaveBeenCalled();
  });

  it('allows valid credentials and fails closed when credentials are not configured', () => {
    const req: any = { headers: { authorization: `Basic ${Buffer.from('docs:secret').toString('base64')}` } };
    const res: any = { setHeader: jest.fn(), sendStatus: jest.fn() };
    const next = jest.fn();
    swaggerBasicAuth('docs', 'secret')(req, res, next);
    expect(next).toHaveBeenCalled();
    swaggerBasicAuth(undefined, undefined)(req, res, next);
    expect(res.sendStatus).toHaveBeenCalledWith(503);
  });

  it('compares fixed-size digests for candidates of different lengths', () => {
    const req: any = { headers: { authorization: `Basic ${Buffer.from('x').toString('base64')}` } };
    const res: any = { setHeader: jest.fn(), sendStatus: jest.fn() };
    const next = jest.fn();
    expect(() => swaggerBasicAuth('docs', 'a-long-secret')(req, res, next)).not.toThrow();
    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
