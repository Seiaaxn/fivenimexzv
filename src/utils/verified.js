export const VERIFIED_EMAIL = 'seiiyvn5@gmail.com';

export const isVerifiedEmail = (email) =>
  !!email && email.toLowerCase() === VERIFIED_EMAIL;
