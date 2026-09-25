const mongoose = require('mongoose');
const argon2 = require('argon2');

const PERMISSIONS = [
  'canViewCredentials',
  'canCreateCredentials',
  'canEditCredentials',
  'canDeleteCredentials',
  'canRevealPasswords',
  'canManageClients',
  'canManageEmployees',
];

const DEFAULT_STAFF_PERMISSIONS = {
  canViewCredentials: true,
  canCreateCredentials: true,
  canEditCredentials: true,
  canDeleteCredentials: false,
  canRevealPasswords: true,
  canManageClients: true,
  canManageEmployees: false,
};

const DEFAULT_ADMIN_PERMISSIONS = PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['ADMIN', 'STAFF'], default: 'STAFF' },
    permissions: {
      type: Object,
      default: DEFAULT_STAFF_PERMISSIONS,
    },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.pre('save', function assignDefaultPermissions(next) {
  if (this.isModified('role')) {
    this.permissions = this.role === 'ADMIN' ? DEFAULT_ADMIN_PERMISSIONS : this.permissions || DEFAULT_STAFF_PERMISSIONS;
  }
  next();
});

userSchema.methods.setPassword = async function setPassword(plainPassword) {
  this.passwordHash = await argon2.hash(plainPassword, { type: argon2.argon2id });
};

userSchema.methods.verifyPassword = async function verifyPassword(plainPassword) {
  return argon2.verify(this.passwordHash, plainPassword);
};

userSchema.methods.hasPermission = function hasPermission(permission) {
  if (this.role === 'ADMIN') return true;
  return !!(this.permissions && this.permissions[permission]);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.PERMISSIONS = PERMISSIONS;
module.exports.DEFAULT_STAFF_PERMISSIONS = DEFAULT_STAFF_PERMISSIONS;
module.exports.DEFAULT_ADMIN_PERMISSIONS = DEFAULT_ADMIN_PERMISSIONS;