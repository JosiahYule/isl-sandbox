// SAMPLE JOBS for layout only. Later these come from the Avionte feed.
// `type` is 'contract' or 'direct' and drives the colour coding.
// `posted` is days ago.

export const jobs = [
  { id: 1, title: 'General labourer', type: 'contract', category: 'Warehousing', city: 'Dartmouth', province: 'NS', pay: '$18.50 an hour', schedule: 'Days, Monday to Friday', posted: 1 },
  { id: 2, title: 'Staff accountant', type: 'direct', category: 'Finance', city: 'Halifax', province: 'NS', pay: '$65,000 to $75,000', schedule: 'Full time, hybrid', posted: 1 },
  { id: 3, title: 'Forklift operator', type: 'contract', category: 'Logistics', city: 'Moncton', province: 'NB', pay: '$20 an hour', schedule: 'Rotating shifts', posted: 2 },
  { id: 4, title: 'Millwright', type: 'contract', category: 'Skilled trades', city: "St. John's", province: 'NL', pay: '$34 an hour', schedule: 'Days, overtime available', posted: 2 },
  { id: 5, title: 'Operations manager', type: 'direct', category: 'Manufacturing', city: 'Charlottetown', province: 'PE', pay: '$85,000 to $95,000', schedule: 'Full time, on site', posted: 3 },
  { id: 6, title: 'Customer service representative', type: 'contract', category: 'Contact centres', city: 'Saint John', province: 'NB', pay: '$17.50 an hour', schedule: 'Evenings and weekends', posted: 3 },
  { id: 7, title: 'Electrical engineer', type: 'direct', category: 'Engineering', city: 'Calgary', province: 'AB', pay: '$95,000 to $115,000', schedule: 'Full time, on site', posted: 4 },
  { id: 8, title: 'Production associate', type: 'contract', category: 'Manufacturing', city: 'Moncton', province: 'NB', pay: '$19 an hour', schedule: 'Nights', posted: 5 },
  { id: 9, title: 'Administrative assistant', type: 'contract', category: 'Administrative', city: 'Halifax', province: 'NS', pay: '$21 an hour', schedule: 'Days, Monday to Friday', posted: 6 },
  { id: 10, title: 'IT systems administrator', type: 'direct', category: 'Technology', city: 'Toronto', province: 'ON', pay: '$80,000 to $90,000', schedule: 'Full time, hybrid', posted: 7 },
];

export const provinces = {
  NS: 'Nova Scotia', NB: 'New Brunswick', PE: 'Prince Edward Island', NL: 'Newfoundland and Labrador',
  QC: 'Quebec', ON: 'Ontario', MB: 'Manitoba', SK: 'Saskatchewan', AB: 'Alberta', BC: 'British Columbia',
};
