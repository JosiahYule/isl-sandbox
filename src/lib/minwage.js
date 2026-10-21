// MINIMUM WAGE in each Atlantic province: the general hourly rate in force, and when it started.
// Used by the Atlantic jobs report and Pay on our open jobs to compare pay with the floor.
// UPDATE: Nova Scotia and PEI change in April and October, New Brunswick and NL in April.
// Checked October 21, 2026 against each province's announcement.
export const MIN_WAGE = {
  NS: { rate: 17.0, since: 'October 1, 2026', source: ['Nova Scotia government', 'https://news.novascotia.ca/en/2025/12/02/minimum-wage-increase-twice-2026-reaching-17-october'] },
  NB: { rate: 15.9, since: 'April 1, 2026', source: ['Canadian HR Reporter', 'https://www.hrreporter.com/focus-areas/payroll/province-announces-boost-to-minimum-wage-in-april/394065'] },
  PE: { rate: 17.3, since: 'October 1, 2026', next: { rate: 17.6, from: 'April 1, 2027' }, source: ['CFIB', 'https://www.cfib-fcei.ca/en/media/pei-minimum-wage-rises-to-17.30-remains-highest-in-atlantic-canada'] },
  NL: { rate: 16.35, since: 'April 1, 2026', source: ['Newfoundland and Labrador government', 'https://www.gov.nl.ca/releases/2026/government-services/0226n02/'] },
};
