import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth endpoints', () => {
  let app: INestApplication;
  const users: any[] = [];
  const prisma = {
    user: {
      findUnique: jest.fn(
        ({ where }: any) =>
          users.find((user) => user.id === where.id || user.email === where.email) ?? null,
      ),
      create: jest.fn(({ data }: any) => {
        const user = {
          id: `user-${users.length + 1}`,
          role: 'STAFF',
          propertyId: null,
          refreshTokenHash: null,
          ...data,
        };
        users.push(user);
        return user;
      }),
      update: jest.fn(({ where, data }: any) => {
        const user = users.find((entry) => entry.id === where.id);
        Object.assign(user, data);
        return user;
      }),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });
  afterAll(async () => app.close());
  it('rejects invalid registration payloads', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'bad', password: 'short', name: '' })
      .expect(400);
  });
  it('rejects unauthenticated access to /auth/me', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });
  it('registers, logs in, refreshes, and returns a sanitized current user', async () => {
    const credentials = {
      email: 'auth-flow@example.com',
      name: 'Auth Flow',
      password: 'password123',
    };
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    expect(registered.body.user).not.toHaveProperty('passwordHash');
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(201);
    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(201);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({
      email: credentials.email,
      name: credentials.name,
      role: 'STAFF',
    });
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });
});
