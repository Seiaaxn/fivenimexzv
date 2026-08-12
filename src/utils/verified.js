export const VERIFIED_EMAIL = 'ryu694602@gmail.com';

export const isVerifiedEmail = (email) =>
  !!email && email.toLowerCase() === VERIFIED_EMAIL;
