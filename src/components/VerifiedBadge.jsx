const VerifiedBadge = ({ title = 'Akun Terverifikasi', size = 15 }) => (
  <svg
    className="verified-badge"
    width={size}
    height={size}
    viewBox="0 0 22 22"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label={title}
    role="img"
  >
    <title>{title}</title>
    <path
      d="M11 0.5l2.47 1.4 2.83-0.4 1.4 2.47 2.47 1.4-0.4 2.83 1.4 2.47-1.4 2.47 0.4 2.83-2.47 1.4-1.4 2.47-2.83-0.4L11 21.5l-2.47-1.4-2.83 0.4-1.4-2.47-2.47-1.4 0.4-2.83L0.83 11l1.4-2.47-0.4-2.83 2.47-1.4 1.4-2.47 2.83 0.4L11 0.5z"
      fill="#1D9BF0"
    />
    <path d="M6.5 11.2l2.8 2.8 6-6.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export default VerifiedBadge;
