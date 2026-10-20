// Industries ISL places in, merged from the live Contract and Direct Hire pages.
// `contract` / `direct` say which service covers it. This drives the industry matrix.
// Descriptions are from the live site where one existed.
//
// Industries with a `slug` get their own page at /industries/<slug>/ (src/pages/industries/[slug].astro):
//   roles  the roles ISL fills most often in that industry (shown as a list)
//   match  which of our open jobs belong to it, by job title. A job belongs to the FIRST industry
//          in `pageOrder` whose pattern matches, so "Class 3 Driver (Recycling)" is waste and
//          recycling, and "Warehouse Labourer / Forklift Operator" is warehousing, not construction.

export const industries = [
  { name: 'Construction and trades', slug: 'construction-and-trades', roles: ['General labourers', 'Carpenters', 'Building erectors', 'Heavy equipment technicians', 'Landscape labourers', 'Site foremen'], match: /carpent|construction|electric|erector|foreman|labou?rer|landscap|technician|inspector|plumb|weld/i,
    contract: true, direct: true,
    note: 'Trades and labour professionals who keep sites productive and timelines on track.' },
  { name: 'Warehousing, logistics and transportation', slug: 'warehousing-and-logistics', roles: ['Warehouse associates', 'Forklift operators', 'Shippers and receivers', 'Pickers and packers', 'Class 1 and 3 drivers', 'Inventory clerks'], match: /forklift|warehouse|shipper|receiver|picker|packer|dock|inventory|material handler|driver|logistics|courier/i,
    contract: true, direct: true,
    note: 'Safety-focused people who keep inventory moving and shipments on schedule.' },
  { name: 'Manufacturing and production', slug: 'manufacturing', roles: ['Production workers', 'Assemblers', 'Machine operators', 'Millwrights', 'Quality inspectors', 'Plant supervisors'], match: /assembl|production|manufactur|machine|millwright|plant|kitting|fabricat/i,
    contract: true, direct: true,
    note: 'Detail-oriented people who keep lines running and quality standards met.' },
  { name: 'Energy, mining and natural resources', contract: true, direct: true,
    note: 'Experienced professionals who keep sites operating safely and assets maintained.' },
  { name: 'Hospitality, retail and customer service', slug: 'hospitality', roles: ['Banquet servers', 'Line cooks', 'Kitchen stewards', 'Event staff', 'Housekeeping', 'Retail associates'], match: /server|cook|banquet|kitchen|steward|event|hospitality|retail|cashier|housekeep|cleaner/i,
    contract: true, direct: true,
    note: 'Front-of-house and back-of-house talent, plus customer-facing roles that represent your brand.' },
  { name: 'Contact centres', contract: true, direct: false,
    note: 'Customer-focused people who deliver consistent service and meet performance targets.' },
  { name: 'Administrative and office', slug: 'administrative-and-office', roles: ['Administrative assistants', 'Receptionists', 'Payroll and AP clerks', 'Data entry clerks', 'Office coordinators', 'Customer service representatives'], match: /admin|payroll|accounts|clerk|reception|assistant|agent|data entry|coordinator|office/i,
    contract: true, direct: false,
    note: 'Organized professionals who keep offices and day-to-day operations running smoothly.' },
  { name: 'Waste and recycling', slug: 'waste-and-recycling', roles: ['Garbage collectors', 'Recycling sorters and pickers', 'Class 3 drivers', 'Yard labourers'], match: /garbage|recycl|waste|sort/i,
    contract: true, direct: false,
    note: 'Personnel who keep collection, processing and disposal running efficiently and in compliance.' },
  { name: 'Engineering and technical services', contract: false, direct: true,
    note: 'Engineering and technical professionals who maintain compliance in complex operations.' },
  { name: 'Finance and business operations', contract: false, direct: true,
    note: 'Finance and operations professionals who improve processes and support decisions.' },
  { name: 'Executive and professional services', contract: false, direct: true,
    note: 'Senior leaders and specialists who provide direction and long-term impact.' },
  { name: 'Technology and IT', contract: false, direct: true,
    note: 'IT professionals who keep systems secure, scalable and aligned with the business.' },
  { name: 'Healthcare and life services', contract: false, direct: true,
    note: 'Professionals who balance technical expertise with strict regulatory and safety standards.' },
  { name: 'Public sector and education', contract: false, direct: true,
    note: 'People who serve public institutions with accountability and compliance in mind.' },
  { name: 'Agriculture and farming', contract: false, direct: true,
    note: 'Agricultural professionals who understand seasonal demands and modern farming operations.' },
];

// The industries with their own page, in the order a job is checked against them
export const pageOrder = ['waste-and-recycling', 'hospitality', 'warehousing-and-logistics', 'manufacturing', 'construction-and-trades', 'administrative-and-office'];
export const industryPages = pageOrder.map((slug) => industries.find((i) => i.slug === slug));
export const industryOf = (title = '') => (industryPages.find((i) => i.match.test(title)) || {}).slug || '';
