const PremiumBadge = ({ title = 'Akun Premium', size = 15 }) => (
  <svg
    className="premium-badge"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-label={title}
    role="img"
    style={{ verticalAlign: 'middle', marginLeft: 3 }}
  >
    <title>{title}</title>
    <defs>
      <linearGradient id="premiumCrownGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFD86B" />
        <stop offset="100%" stopColor="#F5A524" />
      </linearGradient>
    </defs>
    <path
      d="M3 8.5l4 2.8 5-6.3 5 6.3 4-2.8-1.7 9.5H4.7L3 8.5z"
      fill="url(#premiumCrownGradient)"
      stroke="#8A5A00"
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="17.3" r="1.1" fill="#8A5A00" />
  </svg>
);

export default PremiumBadge;
