const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

async function createAdmin() {
  const admin = new User({ name: 'Admin', email: 'admin@example.com', role: 'ADMIN' });
  await admin.setPassword('SuperSecret123!');
  await admin.save();
  return admin;
}

describe('Auth', () => {
  test('rejects login with wrong password', async () => {
    await createAdmin();
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('rejects login for unknown user with generic message', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever123' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  test('logs in successfully with correct credentials and returns tokens', async () => {
    await createAdmin();
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'SuperSecret123!' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('rejects requests without a token', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(401);
  });

  test('rejects login for deactivated account', async () => {
    const admin = await createAdmin();
    admin.isActive = false;
    await admin.save();
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'SuperSecret123!' });
    expect(res.status).toBe(401);
  });

  test('refresh token rotation issues a new token and invalidates the old one', async () => {
    await createAdmin();
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'SuperSecret123!' });
    const { refreshToken } = login.body;

    const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).not.toBe(refreshToken);

    const reused = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(reused.status).toBe(401);
  });
});
