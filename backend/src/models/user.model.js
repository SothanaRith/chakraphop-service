// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER DOMAIN MODEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { ValidationError } from '../utils/errors.js';

class User {
  constructor({ id, email, role, isActive, isEmailVerified }) {
    this.id = id;
    this.email = email;
    this.role = role;
    this.isActive = Boolean(isActive);
    this.isEmailVerified = Boolean(isEmailVerified);
  }

  static fromData(data) {
    return new User({
      id: data.id,
      email: data.email,
      role: data.role,
      isActive: data.isActive,
      isEmailVerified: data.isEmailVerified,
    });
  }

  assertValidEmail() {
    if (!this.email || !this.email.includes('@')) {
      throw new ValidationError('Invalid email address');
    }
  }

  canLogin() {
    return this.isActive;
  }

  assertCanLogin() {
    if (!this.canLogin()) {
      throw new ValidationError('Account is deactivated. Please contact support.');
    }
  }
}

export default User;
