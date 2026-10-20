// ISL's own photography, already on the live site (Squarespace image store).
// Alt text is taken from the live About page. Using real team photos instead of stock
// is deliberate: they can only belong to ISL.

import { url } from '../lib/url.js';

const cdn = (path) => `https://images.squarespace-cdn.com/content/v1/691490c94119776708e69bbe/${path}`;

export const photos = {
  warehouse: { src: cdn('0ef24270-c545-4732-a37c-05b7a7b05030/Isl-home-banner'), alt: 'Worker in an industrial warehouse reviewing a tablet' },
  // Full team photo, October 2026 (supplied by Josiah). Stored in the repo at public/images/team-2026-<width>w.jpg.
  teamTogether: { src: url('/images/team-2026.jpg'), alt: 'The Integrated Staffing team together in the office' },
  teamNL: { src: cdn('86c7d1c3-26f6-4198-b2e0-c5cf8839221f/Group+Photo+-+Team+NL+-+Dec+2025.jpg'), alt: "Integrated Staffing's Newfoundland team, December 2025" },
  chamberAwards: { src: cdn('9e5f5557-c374-4987-a652-b66cf60b8046/f69863e9-db78-4c2f-9a23-6aa42798d9b2.jpg'), alt: 'The Integrated Staffing team at the Chamber Awards' },
  christmasTree: { src: cdn('8c0873ec-85b1-46d0-8f74-5014738a70b7/1764090027761.jpg'), alt: 'Integrated Staffing colleagues beside the office Christmas tree' },
  colleagues: { src: cdn('d9115df7-a870-4c8c-80ad-5e5237972b0e/1760017799648.jpg'), alt: 'Integrated Staffing colleagues' },
  teamMembers: { src: cdn('4e7c3d35-6b01-479e-9d84-df0e8c9c690c/IMG_5011.jpeg'), alt: 'Members of the Integrated Staffing team' },
  teamPhoto: { src: cdn('c832b93f-d70a-4426-b1e9-288f6694b1d3/IMG_0301.jpg'), alt: 'Integrated Staffing team photo' },
  colleaguesTogether: { src: cdn('a4b5b6d4-7ca9-42ba-80ea-33ce468563af/IMG_5863.png'), alt: 'Integrated Staffing colleagues together' },
  megZowie: { src: cdn('9a251d7d-94cd-40f3-819a-70ed26b0c428/381fda9a-3a01-416b-a169-ba90a4c90a41.jpg'), alt: 'Meg and Zowie' },
  chamberTrio: { src: cdn('ff44a3f4-fe47-49ca-be62-8fb535ac88e0/IMG_7571.jpg'), alt: 'Erika, Meg and Shelley at the Chamber Awards' },
  evanFirstYear: { src: cdn('030b303f-7cda-4655-887b-592b5accda3e/IMG_0288.jpg'), alt: "The team celebrating Evan's first year" },
};

// STOCK PHOTOS (Unsplash) already in ISL's Squarespace library from blog posts.
// Used on the service pages until ISL has its own photos of placed workers on the job.
// TODO: replace with ISL's own photography (a half-day shoot at two or three client sites).
export const stock = {
  welder: { src: cdn('1781525441968-BZM3S0N9FX12QYLAE7WO/unsplash-image-9Q_pLLP_jmA.jpg'), alt: 'A welder in a protective helmet working on metal, sparks flying', credit: 'Rob Lambert' },
  construction: { src: cdn('1777913999462-G2VCNH8RY14H1E66HV9J/unsplash-image-X1P1_EDNnok.jpg'), alt: 'A construction worker in a hard hat on a building frame', credit: 'Josh Olalde' },
  interview: { src: cdn('1782998628646-3QZ3AIYS6470XB12D9UQ/vitaly-gariev-2AOIg7Qvu8w-unsplash.jpg'), alt: 'A recruiter reviewing a resume with a candidate in an office', credit: 'Vitaly Gariev' },
  halifax: { src: cdn('1773340555499-TN5WELTYLU7VA9UB347K/unsplash-image-zL7C-G2U7sw.jpg'), alt: 'Aerial view of the Halifax waterfront', credit: 'Chen Liu' },
};
