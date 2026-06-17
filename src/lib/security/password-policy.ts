export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!password || password.length < 12) {
    errors.push('Password must be at least 12 characters long.');
  }
  if (password && password.length > 128) {
    errors.push('Password must be at most 128 characters long.');
  }

  if (password) {
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter.');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number.');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character.');
    }
  }

  // Reject common passwords
  const commonPasswords = [
    'password', 'password123', 'password123!', 'password123456', 'admin123', '123456789', 'qwerty123', 'welcome123', 'letmein123'
  ];
  if (password && commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common and weak.');
  }

  // Sequential and repeated check (length 4 or more)
  if (password) {
    const normalized = password.toLowerCase();
    for (let i = 0; i < normalized.length - 3; i++) {
      const char1 = normalized.charCodeAt(i);
      const char2 = normalized.charCodeAt(i + 1);
      const char3 = normalized.charCodeAt(i + 2);
      const char4 = normalized.charCodeAt(i + 3);

      // check ascending sequence (e.g. 1234, abcd, qwer)
      if (char2 === char1 + 1 && char3 === char2 + 1 && char4 === char3 + 1) {
        errors.push('Password cannot contain sequential characters.');
        break;
      }
      // check descending sequence (e.g. 4321, dcba)
      if (char2 === char1 - 1 && char3 === char2 - 1 && char4 === char3 - 1) {
        errors.push('Password cannot contain sequential characters.');
        break;
      }
      // check repeated characters (e.g. aaaa, 1111)
      if (char1 === char2 && char2 === char3 && char3 === char4) {
        errors.push('Password cannot contain repeated characters.');
        break;
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
