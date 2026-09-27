import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth endpoints', () => {
  let app: INestApplication;
  const users: any[] = [];
  const properties: any[] = [];
  const rooms: any[] = [];
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
    property: {
      findMany: jest.fn(({ where }: any) =>
        properties.filter((property) => !where.ownerId || property.ownerId === where.ownerId),
      ),
      findFirst: jest.fn(
        ({ where }: any) =>
          properties.find(
            (property) => property.id === where.id && property.ownerId === where.ownerId,
          ) ?? null,
      ),
      findUnique: jest.fn(
        ({ where }: any) => properties.find((property) => property.id === where.id) ?? null,
      ),
      create: jest.fn(({ data }: any) => {
        const property = { id: `property-${properties.length + 1}`, ...data };
        properties.push(property);
        return property;
      }),
      update: jest.fn(({ where, data }: any) => {
        const property = properties.find((entry) => entry.id === where.id);
        Object.assign(property, data);
        return property;
      }),
      delete: jest.fn(({ where }: any) => {
        const index = properties.findIndex((entry) => entry.id === where.id);
        return properties.splice(index, 1)[0];
      }),
    },
    room: {
      findMany: jest.fn(({ where }: any) =>
        rooms.filter((room) => room.propertyId === where.propertyId),
      ),
      findFirst: jest.fn(({ where }: any) => {
        const room = rooms.find(
          (entry) => entry.id === where.id && entry.propertyId === where.propertyId,
        );
        return room
          ? { ...room, property: properties.find((property) => property.id === room.propertyId) }
          : null;
      }),
      create: jest.fn(({ data }: any) => {
        const room = { id: `room-${rooms.length + 1}`, status: 'AVAILABLE', ...data };
        rooms.push(room);
        return room;
      }),
      update: jest.fn(({ where, data }: any) => {
        const room = rooms.find((entry) => entry.id === where.id);
        Object.assign(room, data);
        return room;
      }),
      delete: jest.fn(({ where }: any) => {
        const index = rooms.findIndex((entry) => entry.id === where.id);
        return rooms.splice(index, 1)[0];
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
  it('allows an admin to create a property and rooms, and blocks non-admin property deletion', async () => {
    const adminCredentials = { email: 'admin@example.com', name: 'Admin', password: 'password123' };
    await request(app.getHttpServer()).post('/auth/register').send(adminCredentials).expect(201);
    users.find((user) => user.email === adminCredentials.email).role = 'ADMIN';
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminCredentials.email, password: adminCredentials.password })
      .expect(201);
    const adminHeaders = { Authorization: `Bearer ${adminLogin.body.accessToken}` };
    const property = await request(app.getHttpServer())
      .post('/properties')
      .set(adminHeaders)
      .send({ name: 'Harbor Hotel', address: '1 Marina Road', type: 'HOTEL' })
      .expect(201);
    const room = await request(app.getHttpServer())
      .post(`/properties/${property.body.id}/rooms`)
      .set(adminHeaders)
      .send({ label: '101', type: 'Deluxe', capacity: 2, basePrice: 45000 })
      .expect(201);
    expect(room.body.status).toBe('AVAILABLE');
    const listedRooms = await request(app.getHttpServer())
      .get(`/properties/${property.body.id}/rooms`)
      .set(adminHeaders)
      .expect(200);
    expect(listedRooms.body).toHaveLength(1);

    const staffCredentials = { email: 'staff@example.com', name: 'Staff', password: 'password123' };
    await request(app.getHttpServer()).post('/auth/register').send(staffCredentials).expect(201);
    const staffLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: staffCredentials.email, password: staffCredentials.password })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/properties/${property.body.id}`)
      .set({ Authorization: `Bearer ${staffLogin.body.accessToken}` })
      .expect(403);
  });
});
