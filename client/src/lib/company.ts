/**
 * Legal company identity — the single source of truth for the operating entity
 * behind AIPL Hire. Shown on the About page, footer, contact page, and every
 * legal document so the business details are byte-identical everywhere (required
 * for payment-gateway / Cashfree verification).
 *
 * Framework-agnostic (no React) so it can be imported anywhere.
 */
export const COMPANY = {
  /** Public product / brand name. */
  product: 'AIPL Hire',
  /** Registered legal entity that owns and operates the product. */
  legalName: 'Ayansh Institute Private Limited',
  ownership:
    'AIPL Hire is a flagship AI-powered hiring and recruitment platform developed and owned by Ayansh Institute Private Limited.',

  // Statutory registration
  cin: 'U85499BR2025PTC080635',
  regNo: '080635',
  mca: 'MCA Registered Company',

  // Quality certification
  iso: 'ISO 9001:2015',
  isoDesc: 'Quality Management System',
  iafCode: '37',
  naceCode: '85',
  certNo: 'KSRAI2512406912',

  // Recognitions & partners
  nsdc: 'NSDC Partner',
  poweredBy: 'NIIPL Group',
  developer: 'Appsgain Technologies',
  developerUrl: 'https://appsgain.in',

  // Ready-made display strings
  copyright: `© ${new Date().getFullYear()} Ayansh Institute Private Limited. All Rights Reserved.`,
  complianceLine: 'ISO 9001:2015 | IAF CODE 37 | NACE CODE 85 | Cert No. KSRAI2512406912 | MCA Registered',
} as const;

export default COMPANY;
