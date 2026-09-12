const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

describe('Authorization / RBAC', () => {
  test('staff without canManageEmployees permission cannot list employees', async () => {
    const staff = new User({ name: 'Staff', email: 'staff2@example.com', role: 'STAFF' });
    await staff.setPassword('StaffPass123!');
    await staff.save();
    const login = await request(app).post('/api/auth/login').send({ email: 'staff2@example.com', password: 'StaffPass123!' });

    const res = await request(app).get('/api/employees').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('admin can list employees', async () => {
    const admin = new User({ name: 'Admin2', email: 'admin2@example.com', role: 'ADMIN' });
    await admin.setPassword('SuperSecret123!');
    await admin.save();
    const login = await request(app).post('/api/auth/login').send({ email: 'admin2@example.com', password: 'SuperSecret123!' });

    const res = await request(app).get('/api/employees').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
  });

  test('an invalid/garbage token is rejected', async () => {
    const res = await request(app).get('/api/clients').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
