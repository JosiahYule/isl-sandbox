// TRUE COST OF AN EMPLOYEE: the arithmetic behind /learn/tools/true-cost-of-an-employee/.
// Plain functions with no page code, so the tool, its preview card and the test all use the same maths.
//
// The question it answers: you pay someone $X an hour. What does each hour they actually
// work cost you, once the costs every employer in Atlantic Canada must pay are added?
//
// Costs included (all required by law; nothing optional like benefits):
//   - vacation pay        4% of wages (two weeks off, paid)
//   - paid holidays       the province's paid public holidays, paid but not worked
//   - CPP                 employer share, between the basic exemption and the yearly ceiling,
//                         plus CPP2 between the first and second ceilings
//   - EI                  employer premium (1.4 x the employee rate), up to the yearly ceiling
//   - workers' comp       the province's average assessment rate, up to its yearly ceiling
//
// Every rate lives in RATES below, with where it came from. Update them each January.

export const RATES = {
  year: 2026,
  // Canada Revenue Agency, 2026 (advisor.ca, "CRA announces CPP maximum pensionable earnings for 2026")
  cpp: { rate: 0.0595, exemption: 3500, ympe: 74600, cpp2Rate: 0.04, yampe: 85000 },
  // Canada Employment Insurance Commission, 2026: employee $1.63 per $100, employer 1.4x, ceiling $68,900
  ei: { employeeRate: 0.0163, employerFactor: 1.4, max: 68900 },
  vacationPay: 0.04, // every Atlantic province starts at 4% (rises with years of service)
  vacationWeeks: 2,
  // Province: paid public holidays (provincial employment standards) and workers' comp
  // average assessment rate per $100 of payroll and maximum assessable earnings (AWCBC, 2026, provisional)
  provinces: {
    NS: { name: 'Nova Scotia', holidays: 6, wcb: 2.65, wcbMax: 79900 },
    NB: { name: 'New Brunswick', holidays: 8, wcb: 1.10, wcbMax: 85800 },
    PE: { name: 'Prince Edward Island', holidays: 8, wcb: 1.25, wcbMax: 89300 },
    NL: { name: 'Newfoundland and Labrador', holidays: 6, wcb: 1.73, wcbMax: 80935 },
  },
};

export const SOURCES = [
  ['CPP rates and ceilings, 2026', 'https://www.advisor.ca/tax/tax-news/cra-announces-cpp-maximum-pensionable-earnings-for-2026'],
  ['EI premium rate, 2026', 'https://www.canada.ca/en/employment-social-development/news/2025/09/canada-employment-insurance-commission-sets-the-2026-employment-insurance-premium-rate.html'],
  ['Average workers’ comp rates, 2026', 'https://awcbc.org/data-and-statistics/assessments-and-premiums/provisional-average-assessment-rates'],
  ['Workers’ comp earnings ceilings, 2026', 'https://awcbc.org/data-and-statistics/assessments-and-premiums/maximum-assessable-insurable-earnings'],
  ['New Brunswick paid holidays and vacation pay', 'https://www.gnb.ca/en/topic/jobs-workplaces/labour-market-workforce/employment-standards/holiday-vacation.html'],
];

/**
 * trueCost({ wage: 20, hours: 40, province: 'NS', wcb: 2.65 })
 *   -> { perHour, wage, uplift, worked, total, lines: [{ key, label, year, hour }] }
 * wage: hourly pay. hours: scheduled hours a week. wcb: optional, per $100 (defaults to the
 * province's average; an employer's own rate depends on their industry).
 */
export function trueCost({ wage, hours = 40, province = 'NS', wcb } = {}) {
  const p = RATES.provinces[province] || RATES.provinces.NS;
  const wcbRate = (Number.isFinite(wcb) ? wcb : p.wcb) / 100;
  const daily = hours / 5;

  // Hours: the whole year is scheduled; vacation weeks and paid holidays are paid but not worked
  const scheduled = 52 * hours;
  const vacationHours = RATES.vacationWeeks * hours;
  const holidayHours = p.holidays * daily;
  const worked = scheduled - vacationHours - holidayHours;

  // Pay: every scheduled hour except vacation weeks is paid as wages (holidays included),
  // and vacation pay (4% of those wages) covers the weeks off.
  const workedPay = wage * worked;
  const holidayPay = wage * holidayHours;
  const wages = workedPay + holidayPay;
  const vacation = wages * RATES.vacationPay;
  const gross = wages + vacation;

  const { cpp: c, ei: e } = RATES;
  const cpp = Math.max(0, Math.min(gross, c.ympe) - c.exemption) * c.rate
    + Math.max(0, Math.min(gross, c.yampe) - c.ympe) * c.cpp2Rate;
  const ei = Math.min(gross, e.max) * e.employeeRate * e.employerFactor;
  const comp = Math.min(gross, p.wcbMax) * wcbRate;

  const total = gross + cpp + ei + comp;
  const per = (v) => v / worked;
  const lines = [
    { key: 'wage', label: 'Wages for hours worked', year: workedPay },
    { key: 'holidays', label: `${p.holidays} paid holidays`, year: holidayPay },
    { key: 'vacation', label: 'Vacation pay (4%)', year: vacation },
    { key: 'cpp', label: 'CPP, employer share', year: cpp },
    { key: 'ei', label: 'EI, employer premium', year: ei },
    { key: 'wcb', label: 'Workers’ comp', year: comp },
  ].map((l) => ({ ...l, hour: per(l.year) }));

  return { perHour: per(total), wage, uplift: per(total) / wage - 1, worked, total, gross, lines, province: p };
}

export const money = (n, cents = true) =>
  '$' + n.toLocaleString('en-CA', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
