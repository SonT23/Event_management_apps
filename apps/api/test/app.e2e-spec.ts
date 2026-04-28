import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

function readCookieName(cookies: string[], name: string) {
  for (const c of cookies) {
    if (c.startsWith(`${name}=`)) {
      return c.split(';')[0];
    }
  }
  return '';
}

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.enableShutdownHooks();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it('GET /api/health/ready', () => {
    return request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.database).toBe('up');
      });
  });

  it('GET /api/auth/me without token => 401', () => {
    return request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('POST /api/auth/login invalid body => 400', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'x', password: '' })
      .expect(400);
  });

  it('POST /api/auth/login wrong password => 401', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nouser@example.com', password: 'wrong' })
      .expect(401);
  });

  it('POST login (seed) + Set-Cookie + /me with Bearer and cookie + refresh', async () => {
    const agent = request(app.getHttpServer());
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'demo.hoi-vien@example.com', password: 'Test123!@#' })
      .expect(200);
    expect(login.body.accessToken).toBeDefined();
    expect(login.headers['set-cookie']?.toString()).toMatch(/med_access/);
    const a = await agent
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(a.body.email).toBe('demo.hoi-vien@example.com');
    const setCookie = login.headers['set-cookie'];
    const cookies: string[] = Array.isArray(setCookie)
      ? setCookie
      : setCookie
        ? [setCookie as unknown as string]
        : [];
    const accessPart = readCookieName(cookies, 'med_access');
    const refreshPart = readCookieName(cookies, 'med_refresh');
    if (accessPart && refreshPart) {
      const b = await agent
        .get('/api/auth/me')
        .set('Cookie', [accessPart, refreshPart].join('; '))
        .expect(200);
      expect(b.body.email).toBe('demo.hoi-vien@example.com');
    }
    const ref = await agent
      .post('/api/auth/refresh')
      .set('Cookie', [accessPart, refreshPart].filter(Boolean).join('; '))
      .expect(200);
    expect(ref.body.accessToken).toBeDefined();
  });

  it('leadership: deactivate member -> login 401, reactivate -> login 200', async () => {
    const agent = request(app.getHttpServer());
    const email = `e2e.inactive.${Date.now()}@example.com`;
    const reg = await agent
      .post('/api/auth/register')
      .send({
        email,
        password: 'Longpass1!',
        fullName: 'E2E Inactive Test',
        primaryDepartmentId: 1,
      })
      .expect(201);
    const newUserId = reg.body.user?.id;
    expect(newUserId).toBeDefined();

    const lead = await agent
      .post('/api/auth/login')
      .send({ email: 'demo.chu-nhiem@example.com', password: 'Test123!@#' })
      .expect(200);
    const t = lead.body.accessToken as string;

    await agent
      .patch(`/api/members/${newUserId}/membership`)
      .set('Authorization', `Bearer ${t}`)
      .send({ status: 'inactive', reason: 'e2e' })
      .expect(200);

    await agent
      .post('/api/auth/login')
      .send({ email, password: 'Longpass1!' })
      .expect(401);

    await agent
      .patch(`/api/members/${newUserId}/membership`)
      .set('Authorization', `Bearer ${t}`)
      .send({ status: 'active' })
      .expect(200);

    await agent
      .post('/api/auth/login')
      .send({ email, password: 'Longpass1!' })
      .expect(200);
  });

  it('POST register (unique) + 400 duplicate email', async () => {
    const email = `e2e.${Date.now()}@example.com`;
    const agent = request(app.getHttpServer());
    const r = await agent
      .post('/api/auth/register')
      .send({
        email,
        password: 'Longpass1!',
        fullName: 'E2E User',
        primaryDepartmentId: 1,
      })
      .expect(201);
    expect(r.body.user?.email).toBe(email);
    expect(r.body.accessToken).toBeDefined();
    await agent
      .post('/api/auth/register')
      .send({
        email,
        password: 'Longpass1!',
        fullName: 'Dup',
        primaryDepartmentId: 1,
      })
      .expect(409);
  });
});
