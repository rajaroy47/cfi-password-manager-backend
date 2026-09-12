/**
 * Safe initial admin creation.
 *
 * Usage:
 *   npm run create-admin
 *
 * Prompts interactively for name/email/password so no default credentials
 * are ever hardcoded or committed. Refuses to run if an ADMIN already
 * exists, unless --force is passed.
 */
require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User');

function ask(rl, question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    if (!hidden) {
      rl.question(question, resolve);
      return;
    }
    // Simple masked input for password prompts
    const stdin = process.stdin;
    process.stdout.write(question);
    let input = '';
    const onData = (char) => {
      char = char.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.removeListener('data', onData);
        stdin.setRawMode && stdin.setRawMode(false);
        process.stdout.write('\n');
        resolve(input);
        return;
      }
      if (char === '\u0003') process.exit(1); // Ctrl+C
      if (char === '\u007f') {
        input = input.slice(0, -1);
        return;
      }
      input += char;
    };
    stdin.setRawMode && stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function main() {
  const force = process.argv.includes('--force');

  await mongoose.connect(env.mongoUri);

  const existingAdmin = await User.findOne({ role: 'ADMIN' });
  if (existingAdmin && !force) {
    console.log(`An admin account already exists (${existingAdmin.email}). Use --force to create another.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let name = '';
  while (!name.trim()) {
    name = await ask(rl, 'Admin full name: ');
  }

  let email = '';
  while (!isValidEmail(email)) {
    email = await ask(rl, 'Admin email: ');
    if (!isValidEmail(email)) console.log('  Please enter a valid email address.');
  }

  const emailTaken = await User.findOne({ email: email.toLowerCase().trim() });
  if (emailTaken) {
    console.log('A user with this email already exists. Aborting.');
    rl.close();
    await mongoose.disconnect();
    process.exit(1);
  }

  let password = '';
  while (password.length < 12) {
    password = await ask(rl, 'Admin password (min 12 characters): ', { hidden: true });
    if (password.length < 12) console.log('  Password must be at least 12 characters.');
  }

  rl.close();

  const admin = new User({ name: name.trim(), email: email.toLowerCase().trim(), role: 'ADMIN' });
  await admin.setPassword(password);
  await admin.save();

  console.log(`\n✔ Admin account created: ${admin.email}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create admin:', err.message);
  process.exit(1);
});
