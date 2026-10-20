// Team members, from the live site's bio pages.
// `slug` is the bio page address on the live site (integratedstaffing.ca/<slug>).
// `photo` is the headshot from their live bio page (Squarespace image store), without a size.
// Note: on the live site several headshots carry another person's name as their alt text (e.g. Kelli's says
// "Zowie Tucker"), so photos are matched by their place on each bio page, not by alt text.
// Titles, provinces, contact details and bios come from src/data/bios.js (merged in below).

import { bios } from './bios.js';

const cdn = (path) => `https://images.squarespace-cdn.com/content/v1/691490c94119776708e69bbe/${path}`;

const people = [
  { name: 'Greg White', slug: 'greg-white', role: 'CEO', team: 'Leadership', photo: cdn('347a41ba-e729-495e-ad94-39b2a85f1118/Headshot+-+G.+White.png') },
  { name: 'Ross Argante', slug: 'ross-argante', role: 'Partner', team: 'Leadership', photo: cdn('4bb0b36f-5c7d-46b8-a60d-367f177563c9/integrated_2024_1723web+%281%29.jpg') },
  { name: 'Chance Skauge', slug: 'chance-skauge', role: 'Director of Business Development', team: 'Leadership', photo: cdn('ed563cb9-3419-44a3-a7e5-59589393f3c7/Headshot+-+Chance+Skauge.jpg') },
  { name: 'Zowie Tucker', slug: 'zowie-tucker', role: 'Senior Recruitment Consultant', team: 'Direct Hire', photo: cdn('471bd9d6-a42f-4bdd-84bc-47ae0b3f7e5d/Integrated+Staffing+Zowie+Tucker_1+%281%29.jpg') },
  { name: 'Shane Ico', slug: 'shane-ico', role: 'Recruitment Consultant', team: 'Direct Hire', photo: cdn('854d545a-6cd8-41ec-aea2-db95d41993cf/Integrated+Staffing+Shane+Ico.jpg') },
  { name: 'Lisa Laviolette', slug: 'lisa-laviolette', role: 'Recruitment Consultant', team: 'Direct Hire', photo: cdn('967f478a-b4c1-4236-8703-48d355f1cce2/d247e9aa-54c1-4a72-b108-ab50880696c2.jpg') },
  { name: 'Kayla Jamieson', slug: 'kayla-jamieson', role: 'Recruitment Consultant', team: 'Direct Hire', photo: cdn('75e91452-b766-4e60-ac55-0c75bb6c2616/Kayla+Jamieson.png') },
  { name: 'Amber Antle', slug: 'amber-antle', role: '', photo: cdn('768d3e2a-b0eb-44af-a48c-2fa25c843713/IMG_0975.png') },
  { name: 'Natacha Bailey', slug: 'natacha-bailey', role: '', photo: cdn('e18bddfe-5d64-407c-bbee-4b34381d37c6/Headshot+-+N.+Bailey.png') },
  { name: 'Laura Coyle', slug: 'laura-coyle', role: '', photo: cdn('70f9ceb8-76bf-4415-b32f-cdbba19bd9e9/Laura+C+Headshot.png') },
  { name: 'Michaila Doiron', slug: 'michaila-doiron', role: '', photo: cdn('96afec44-c1c5-4278-8497-ea049977aa7a/024A1684.jpg') },
  { name: 'Megan Ferguson', slug: 'megan-ferguson', role: '', photo: cdn('e09b703e-98d4-4fcd-81ee-784e873d0f3e/Headshot+-+Megan+Ferguson.jpg') },
  { name: 'Nicole Fudge', slug: 'nicole-fudge', role: '', photo: cdn('ef4581bc-24d6-4baf-9720-e7633a7936d1/websized-mdwed_2022_0128_1.jpg') },
  { name: 'Carrie Fullarton', slug: 'carrie-fullarton', role: '', photo: cdn('d54271f1-1eb7-4dfa-8743-5e586e637316/Carrie+F.+Headshot') },
  { name: 'Skylar Hardwick', slug: 'skylar-hardwick', role: '', photo: cdn('0bd6add1-06f1-4a63-ace6-538e53b49a0c/Integrated+Staffing+Skylar+Hardwick.jpg') },
  { name: 'Shelley Lewis', slug: 'shelley-lewis', role: '', photo: cdn('89e129a9-cf97-4f47-b10a-665fb96c2d83/Screenshot+2025-08-05+111222_0.png') },
  { name: 'James Locke', slug: 'james-locke', role: '', photo: cdn('a4eaa1f0-9a60-49d6-b2d2-d6693431e772/2.png') },
  { name: 'Marine Migliore', slug: 'marine-migliore', role: '', photo: cdn('2dfb87e4-d375-4b85-8268-aa46002c892e/Marine-migliore.jpg') },
  { name: 'Crystal Murphy', slug: 'crystal-murphy', role: '', photo: cdn('e921f8f3-efa2-46ca-908d-7c0466f5cb6e/3.png') },
  { name: 'Ashton Murray', slug: 'ashton-murray', role: '', photo: cdn('bc129d0d-4d81-47c9-8810-c693e282707d/Ashton-murray.jpg') },
  { name: 'Jessica Nash', slug: 'jessica-nash', role: '', photo: cdn('27e2cd83-1b6e-44f9-8a78-cc9a28b9b6e7/Screenshot+2025-08-05+110436.png') },
  { name: 'Julia Parker', slug: 'julia-parker', role: '', photo: cdn('9f67fad0-959f-486b-84f1-76073eed3d9f/Julia+P+Headshot.png') },
  { name: 'Nicole Robertson', slug: 'nicole-robertson', role: '', photo: cdn('41de8177-1ebe-4ead-b6e4-a4c7fb109e82/Headshot+-+Nicole+Robertson+copy_0.jpg') },
  { name: 'Erika Smeltzer', slug: 'erika-smeltzer', role: '', photo: cdn('eb9a76cf-de9a-49f7-b06a-a60776fbf71b/2.png') },
  { name: 'Sonja Speight', slug: 'sonja-speight', role: '', photo: cdn('12ae6951-323c-462a-a24f-68becebbed01/Sonja+Headshot_1.jpg') },
  { name: 'Meg Antonick', slug: 'meg-antonick', role: '', photo: cdn('08195d05-31a1-41ef-aa76-946ecfb272d5/Headshot+-+M.+Antonick.jpg') },
  { name: 'Evan Way', slug: 'evan-way', role: '', photo: cdn('e87ae312-c01f-4440-b72c-e83ed212cecc/1.png') },
  { name: 'Brady Wells', slug: 'brady-wells', role: '', photo: cdn('78143d58-953c-4d76-871c-919ca8a10037/Brady+W+Headshot.png') },
  { name: 'Kelli Wetmore', slug: 'kelli-wetmore', role: '', photo: cdn('0a6f5757-c713-4324-bedc-83e05e8973d5/Kelli-Wetmore.jpg') },
  { name: 'Josiah Yule', slug: 'josiah-yule', role: 'Marketing Coordinator', photo: cdn('0f317710-5e34-4396-8ea2-b3f16f46e21f/Untitled+%28Instagram+Post+%2845%29%29+%284%29+%281%29.png') },
];

// Each person, with their title, province, contact details and bio from bios.js
export const team = people.map((p) => ({ ...p, ...(bios[p.slug] || {}), role: bios[p.slug]?.title || p.role }));
