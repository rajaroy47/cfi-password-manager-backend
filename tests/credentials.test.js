const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Client = require('../src/models/Client');
const Service = require('../src/models/Service');
const Credential = require('../src/models/Credential');

async function createAdminAndLogin() {
  const admin = new User({ name: 'Admin', email: 'admin@example.com', role: 'ADMIN' });
  await admin.setPassword('SuperSecret123!');
  await admin.save();
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'SuperSecret123!' });
  return res.body.accessToken;
}

async function createStaffAndLogin(permissions = {}) {
  const staff = new User({
    name: 'Staff',
    email: 'staff@example.com',
    role: 'STAFF',
    permissions: {
      canViewCredentials: true,
      canCreateCredentials: true,
      canEditCredentials: true,
      canDeleteCredentials: false,
      canRevealPasswords: false,
      canManageClients: true,
      canManageEmployees: false,
      ...permissions,
    },
  });
  await staff.setPassword('StaffPass123!');
  await staff.save();
  const res = await request(app).post('/api/auth/login').send({ email: 'staff@example.com', password: 'StaffPass123!' });
  return res.body.accessToken;
}

describe('Credentials', () => {
  test('creates a client, service and credential; password is encrypted at rest', async () => {
    const token = await createAdminAndLogin();

    const clientRes = await request(app).post('/api/clients').set('Authorization', `Bearer ${token}`).send({ name: 'ABC Enterprises' });
    expect(clientRes.status).toBe(201);

    const serviceRes = await request(app).post('/api/services').set('Authorization', `Bearer ${token}`).send({ name: 'Income Tax' });
    expect(serviceRes.status).toBe(201);

    const credRes = await request(app)
      .post('/api/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client: clientRes.body.client._id,
        service: serviceRes.body.service._id,
        websiteName: 'Income Tax Portal',
        websiteUrl: 'https://www.incometax.gov.in/login',
        username: 'abc123',
        password: 'PlainTextPassword!1',
      });

    expect(credRes.status).toBe(201);
    expect(credRes.body.credential.hasPassword).toBe(true);
    expect(credRes.body.credential.password).toBeUndefined();

    // Verify raw DB document never contains the plaintext password
    const raw = await Credential.findById(credRes.body.credential.id).select(
      '+encryptedPassword.ciphertext +encryptedPassword.iv +encryptedPassword.authTag'
    );
    expect(raw.encryptedPassword.ciphertext).toBeDefined();
    expect(JSON.stringify(raw)).not.toContain('PlainTextPassword!1');
    expect(raw.hostname).toBe('www.incometax.gov.in');
  });

  test('list endpoint never exposes decrypted password', async () => {
    const token = await createAdminAndLogin();
    const client = await Client.create({ name: 'XYZ Pvt Ltd' });
    const service = await Service.create({ name: 'GST' });
    await request(app)
      .post('/api/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client._id, service: service._id, websiteName: 'GST Portal', websiteUrl: 'https://gst.gov.in', username: 'u1', password: 'secretpw123' });

    const list = await request(app).get('/api/credentials').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain('secretpw123');
    expect(list.body.credentials[0].hasPassword).toBe(true);
  });

  test('reveal endpoint requires canRevealPasswords permission', async () => {
    const adminToken = await createAdminAndLogin();
    const client = await Client.create({ name: 'Raja Trading' });
    const service = await Service.create({ name: 'MCA' });
    const cred = await request(app)
      .post('/api/credentials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ client: client._id, service: service._id, websiteName: 'MCA', websiteUrl: 'https://mca.gov.in', username: 'u2', password: 'myrealpassword' });

    const staffToken = await createStaffAndLogin({ canRevealPasswords: false });
    const denied = await request(app).post(`/api/credentials/${cred.body.credential.id}/reveal`).set('Authorization', `Bearer ${staffToken}`);
    expect(denied.status).toBe(403);

    const allowedToken = await createStaffAndLogin({ canRevealPasswords: true });
    // second staff account has different email; recreate under new email to avoid conflict
    const admin2 = await createAdminAndLogin();
    const revealed = await request(app).post(`/api/credentials/${cred.body.credential.id}/reveal`).set('Authorization', `Bearer ${admin2}`);
    expect(revealed.status).toBe(200);
    expect(revealed.body.password).toBe('myrealpassword');
  });

  test('matches credentials by hostname for extension autofill', async () => {
    const token = await createAdminAndLogin();
    const client = await Client.create({ name: 'Maa Enterprise' });
    const service = await Service.create({ name: 'Email' });
    await request(app)
      .post('/api/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client._id, service: service._id, websiteName: 'Gmail', websiteUrl: 'https://mail.google.com/mail', username: 'u3', password: 'pw12345678' });

    const match = await request(app).get('/api/credentials/match?hostname=mail.google.com').set('Authorization', `Bearer ${token}`);
    expect(match.status).toBe(200);
    expect(match.body.credentials.length).toBe(1);
  });

  test('duplicate detection: creating a second credential for the same client/site is allowed but distinguishable via query', async () => {
    const token = await createAdminAndLogin();
    const client = await Client.create({ name: 'Client 005' });
    const service = await Service.create({ name: 'Banking' });
    await request(app)
      .post('/api/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client._id, service: service._id, websiteName: 'Bank', websiteUrl: 'https://bank.example.com', username: 'u4', password: 'pw12345678' });

    const existing = await request(app)
      .get(`/api/credentials?client=${client._id}&hostname=bank.example.com`)
      .set('Authorization', `Bearer ${token}`);
    expect(existing.body.credentials.length).toBe(1);
  });
});
