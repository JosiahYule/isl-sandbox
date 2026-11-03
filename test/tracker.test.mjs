// The AS/ADS Tracker RMS feed: its wrapping, its places, and which brand each job goes to.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rowsIn, toJob, placeOf, dateOf, payOf, brandOf, descriptionOf } from '../scripts/fetch-tracker.mjs';

test('finds the jobs inside Tracker\'s { Jobs: { Job: [...] } } wrapping, including a single job', () => {
  assert.equal(rowsIn({ Jobs: { Job: [{ title: 'A', reference: '1' }, { title: 'B', reference: '2' }] } }).length, 2);
  assert.equal(rowsIn({ Jobs: { Job: { title: 'A', reference: '1' } } }).length, 1);
  assert.equal(rowsIn({ Jobs: '' }).length, 0);
});

test('sector picks the brand; a blank sector goes by the title', () => {
  assert.equal(brandOf({ sector: 'Accountancy', title: 'Office Manager' }), 'as');
  assert.equal(brandOf({ sector: 'Admin and Secretarial', title: 'Business Development Manager' }), 'ads');
  assert.equal(brandOf({ sector: '', title: 'Accounting Technician' }), 'as');
  assert.equal(brandOf({ sector: '', title: 'Administrator' }), 'ads');
});

test('every location shape in the feed becomes a city and province', () => {
  assert.deepEqual(placeOf('Halifax, NS'), { city: 'Halifax', province: 'NS', note: '' });
  assert.deepEqual(placeOf('New Brunswick'), { city: 'New Brunswick', province: 'NB', note: '' });
  assert.deepEqual(placeOf('Dartmouth, NS, Remote'), { city: 'Dartmouth', province: 'NS', note: 'Remote' });
  assert.deepEqual(placeOf('Dartmouth/Saint John, NS/NB'), { city: 'Dartmouth / Saint John', province: 'NS', note: '' });
  assert.deepEqual(placeOf(''), { city: 'Atlantic Canada', province: '', note: '' });
});

test('dates, pay and job types', () => {
  assert.equal(dateOf('03 Nov 2026'), '2026-11-03');
  assert.equal(payOf({ salaryfrom: '55000', salaryto: '65000', salaryper: 'Annum' }), '$55,000 to $65,000/year');
  assert.equal(payOf({}), '');
  const { job } = toJob({ reference: 'JOB-1', title: 'Office Administrator', location: 'Truro, NS', worktype: 'Fixed Term Contract', publishdate: '01 Oct 2026', sector: 'Admin and Secretarial' });
  assert.equal(job.employment, 'Temporary / contract');
  assert.equal(job.note, 'Fixed term');
  assert.equal(job.viewUrl, 'https://www.administrativestaffing.ca/job-details?jobcode=JOB-1');
  assert.equal(job.applyUrl, 'https://evoportalus.tracker-rms.com/Resource/Register/?db=AccountingStaffingAndAdministrativeStaffing&jobcode=1');
});

test('descriptions arrive as text or wrapped in #cdata-section, never as [object Object]', () => {
  assert.equal(descriptionOf({ '#cdata-section': '<p>Hi</p>' }), '<p>Hi</p>');
  assert.equal(descriptionOf('<p>Hi</p>'), '<p>Hi</p>');
  assert.equal(descriptionOf(undefined), '');
  const { job } = toJob({ reference: 'JOB-2', title: 'Controller', location: 'Halifax, NS', sector: 'Accountancy', description: { '#cdata-section': '<p><strong>About the role</strong></p><ul><li>Lead month-end</li></ul>' } });
  assert.match(job.description, /About the role/);
  assert.doesNotMatch(job.description, /object Object|<p>/);
});
