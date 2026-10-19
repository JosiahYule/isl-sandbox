// ISL's own photography, already on the live site (Squarespace image store).
// Alt text is taken from the live About page. Using real team photos instead of stock
// is deliberate: they can only belong to ISL.

const cdn = (path) => `https://images.squarespace-cdn.com/content/v1/691490c94119776708e69bbe/${path}`;

export const photos = {
  warehouse: { src: cdn('0ef24270-c545-4732-a37c-05b7a7b05030/Isl-home-banner'), alt: 'Worker in an industrial warehouse reviewing a tablet' },
  teamTogether: { src: cdn('381545d4-7b42-4989-9acd-47cc60b57781/IMG_0526.jpg'), alt: 'The Integrated Staffing team together' },
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
