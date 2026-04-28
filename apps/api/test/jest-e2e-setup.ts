process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-jwt-secret-must-be-long-enough-for-hs256!!';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
