// ADMINISTRATIVE STAFFING: THE WORDS ON EACH PAGE, from administrativestaffing.ca.
//
// Word for word from the live pages (read in the browser, October 30, 2026), with these changes:
//   - headings, menu labels and buttons in sentence case, as on ISL's site
//   - curly quotes and apostrophes
//   - em dashes became a full stop, or a spaced en dash as on Accountant Staffing's pages
// The live homepage lists Accountant Staffing's roles by mistake, so the roles and the text above
// them come from the live Job Seekers page instead.
// An FAQ answer can be a string, or a list of paragraphs where a nested list is a bulleted list.

export const copy = {
  // Homepage  (EXACT, except the search label and "Request talent", which are the new site's)
  home: {
    h1: ['Focused on staffing', 'administrative positions.'],
    lead: 'We are a specialist recruitment firm based in Atlantic Canada catering to the needs of a broad spectrum of clients throughout the Atlantic Provinces. Focusing on a wide variety of administrative positions, we assist employers with the candidate search process and meet with qualified candidates looking for that next great opportunity.',
    findJob: 'Find your next job!',
    whyTitle: 'Why choose Administrative Staffing?',
    why: [
      ['Specialization', 'By focusing on our area of expertise, we know the industry, the market, and provide your organization with the most current, professional, and experienced administrative candidates.'],
      ['Quick turnaround', 'We continuously meet with new candidates and build lasting relationships, allowing us to manage your search quickly and efficiently when you need it most.'],
      ['Contingency based', 'We are results-driven. You pay no fees unless you hire one of our candidates, so our success is directly tied to yours.'],
      ['Relationships', 'We take a personal approach, getting to know candidates well beyond their resumes to recommend people who will truly thrive in your role.'],
      ['Fit', 'Whether the opportunity is a one-week contract or a permanent role, our focus is always on finding the absolute best candidate for your position and your company culture.'],
    ],
    rolesTitle: 'What our clients are looking for',
    rolesText: [
      'When employers in Atlantic Canada call us for recruitment assistance, we obtain very detailed information about the skills, experience and educational requirements for the position, as well as other soft skills that would result in a great match.',
      'Administrative Staffing recruits for administrative roles that are temporary or permanent at all levels including junior, intermediate and senior levels. Examples of roles include:',
    ],
    localTitle: 'Locally owned and operated',
    localText: 'Owned and operated in Atlantic Canada, we believe supporting locally owned businesses builds stronger communities for us all.',
    ctaTitle: 'We’d love to hear from you.',
    ctaText: 'Looking for your next opportunity or need staff support?',
  },

  // The roles at each level (EXACT, from the live Job Seekers page)
  levels: [
    { name: 'Junior', roles: ['Reception', 'Administrative Support', 'Data Entry', 'File Clerk', 'Records Clerk'] },
    { name: 'Intermediate', roles: ['Administrative Coordinator', 'Human Resources Assistant', 'Marketing Assistant', 'Project Administrator', 'Legal Administrator', 'Paralegal'] },
    { name: 'Senior', roles: ['Executive Assistant', 'Office Manager', 'Donor Relations Officer', 'Project Coordinator'] },
  ],

  // Employers  (EXACT; each step's two paragraphs run together)
  employers: {
    title: 'Staffing solutions for employers.',
    intro: [
      'At Administrative Staffing our focus is the recruitment and placement of the most talented temporary or permanent administrative professionals.',
      'We work closely with employers in Atlantic Canada to identify the needs for their role and strive for a precise match between these requirements and the candidate’s qualifications.',
      'Whether it’s filling in for vacationing employees, covering a maternity leave or increasing staff to meet your growing business demands, our workers can be available within hours of your request.',
      'The Administrative Staffing team will work with you to develop an understanding of your operations and find you the right worker for the job. Our unmatched flexibility and convenience offers a smart way to screen prospective employees before integrating them into your team.',
    ],
    approachTitle: 'Our approach',
    approachSub: 'Resources to attract skilled candidates',
    approachText: [
      'We use extensive resources to attract skilled candidates who are actively searching for new opportunities, as well as those who aren’t actively looking themselves, but are open to opportunities presented to them.',
      'We have built a reputation of consistently providing high quality recruitment services to our clients. Our experienced recruiters are able to respond very quickly to clients’ staffing requirements through:',
    ],
    sources: [
      'Our internal database of registered, qualified candidates',
      'Our extensive list of industry and professional contacts',
      'A referral program where top candidates are referred to our organization',
      'Candidates interested in moving to or returning to Atlantic Canada',
      'Responses to ongoing advertisements posting on the Administrative Staffing website, various recruitment websites and marketing in a variety of venues',
      'Our relationships with job search resource centres, colleges and universities',
    ],
    processTitle: 'Our process',
    processIntro: 'We will work closely with you at each stage of the search process, keeping you updated and receiving your feedback throughout.',
    steps: [
      ['To start', 'First and foremost, we need to gain an understanding of the role and your organization. We will work with you to develop an overview of the position and to assess the qualifications, as well as the “soft” skills that are required for the role. We can help you develop the job responsibilities and requirements for the role and provide current market salary data that reflects a wide range of qualifications. We will review our process with you and establish a timeline that suits your needs.'],
      ['The search', 'Using all of our resources, we identify top candidates for your position. Recruitment Consultants have administered relevant skills testing with all registered candidates, as well as performed thorough interviews to gain an understanding of their professional experience, accomplishments, strengths and weaknesses, and educational background. We also discuss their goals, ambitions, and motivations, so that we can present to you the candidates whom we feel are best suited for your position. Since we meet with people on an ongoing basis, we quickly identify ideal candidates from our established database in addition to new applicants.'],
      ['The presentation', 'Next we present you with a short-list of top candidates. We will brief you on each candidate, reviewing such areas as skill competencies and experience, software knowledge, salary expectations, as well as the reason the candidate is interested in the role. At your convenience, we will arrange for you and others involved in the selection process to interview the desired candidates.'],
      ['Ensuring success', 'Once you’ve made your selection, we take care of the remaining details. Criminal background checks are completed for all candidates receiving an offer – temporary or permanent. As well, we notify all unsuccessful candidates of the outcome. For permanent roles, we can assist you with drafting the terms of employment and finalizing the job offer. We will act as intermediary, negotiating on your behalf if required. For contract positions, the candidate is on our payroll and we manage all necessary documentation including payroll, employee remittances and contract termination procedures at the end of the work period. Also, we will touch base with you and the contractor periodically throughout the contract.'],
    ],
  },

  // Permanent Recruitment FAQ  (questions and answers EXACT)
  permanent: {
    title: 'Permanent recruitment FAQ',
    faq: [
      ['How long does it take to fill a position?', [
        'As a local firm specializing in administrative recruitment, we meet with and register candidates at all levels on an ongoing basis. The result is a strong network of contacts in our industry and the ability to assist employers with their recruitment needs quickly and within their timeline.',
        'While we are often able to find the perfect candidates for your position in our current network, we also perform a full search to source additional candidates including development and placement of recruitment ads, ongoing interviews with prospective candidates, and reaching out to industry associations relevant to your business.',
      ]],
      ['How could your search results differ from my own?', [
        'Time. Reach. Longevity.',
        'When an employer needs an employee, they want to find the absolute best person for their company. When recruiting on their own, employers typically place an ad and rely on that ad to attract the candidates they need. Unfortunately, all the top candidates may not be looking at employment ads on an ongoing basis. Working candidates may not reply to general ads due to confidentiality concerns or non-working people may be applying to positions where they know they will not be staying for the long-term.',
        'Our consultants meet with people at all levels allowing us to get a true sense of where that person wants to be in their career. What motivates the candidate, what is their dream job and where they see themselves long-term are topics explored. With this information, we are able to make informed suggestions of people who we think will be happy and thrive in your role. It’s a win-win.',
      ]],
      ['Are there any upfront fees?', 'No. We work only on a contingency basis. Whether you require a temporary worker or would like to engage our services to complete a permanent search, you pay a fee only if you hire one of our candidates.'],
      ['How much does the service cost?', 'For permanent recruitment, we charge a one-time professional fee based on the candidate’s first-year compensation.'],
      ['What happens if the employee does not work out as planned?', 'Occasionally an employee does not work out or decides to move on to another position. For permanent searches we provide a six month guarantee so that should the individual resign or be dismissed within six months of the start date of employment, we will find a suitable replacement at no additional cost.'],
    ],
  },

  // Temporary Recruitment FAQ  (questions and answers EXACT, except the fees answer: the live page says "contract
  // accountant", copied from Accountant Staffing's; "temporary worker" as on the ADS Permanent FAQ, Josiah's call October 30)
  temporary: {
    title: 'Temporary recruitment FAQ',
    faq: [
      ['What types of temporary roles do you fill?', [
        'Employers may require temporary assistance for a variety of reasons. Here are just a few:',
        ['Special projects', 'Parental leaves', 'Peak work periods', 'Sudden position vacancies', 'Vacation coverage', 'Employee leaves of absence'],
        'Temporary staffing allows you to meet your immediate staffing needs quickly and flexibly. Additionally, employers may want to evaluate a contract candidate as a potential permanent employee.',
      ]],
      ['How long does it take to fill a position?', 'As part of the registration process, candidates must pass a thorough pre-screening process including skills testing, a comprehensive interview and reference checking. Consequently, our contractors are ready to go at a moment’s notice and we are able to fill temporary positions very quickly.'],
      ['Can I determine the length of a contract?', 'Absolutely. Our contracts are designed to ensure you have complete flexibility in your staffing needs. While it helps the process to know the approximate length at the start of the contract, you are free to terminate the contract at any time, without penalty, should your needs change or extend the contract should the person continue to be available.'],
      ['Do contract employees ever become permanent?', 'Yes. In a significant number of our assignments, the contract employee is hired permanently by our client either during the contract or following its completion. In fact, many employers view the contract option as a good way of seeing if the person is a good long-term fit before making the decision to hire permanently.'],
      ['Are there any upfront fees?', 'No. We work only on a contingency basis. Whether you require a temporary worker or would like to engage our services to complete a permanent search, you pay a fee only if you hire one of our candidates.'],
      ['How much does the service cost?', 'On a temporary staffing basis, our fee is built into an hourly rate which includes all costs: the contractor’s salary, employer EI and CPP benefits, payroll processing costs and contract staffing fees. The hourly rate depends on the level of position and the individual contractor’s experience and skills.'],
      ['What happens if the contractor does not work out?', 'Occasionally a contractor does not work out or decides to move on to another position. If this happens, we will source new contractor candidates to consider as replacements. Alternatively, you may choose to end the contract.'],
    ],
  },

  // Job Seekers  (EXACT; the meeting paragraphs are split into steps, in the live order)
  seekers: {
    title: 'Job placement solutions for workers.',
    intro: [
      'At Administrative Staffing, our sole focus is the recruitment and placement of talented administrative professionals throughout Atlantic Canada.',
      'Whether you are looking for a permanent career change or the flexibility and experience that can be gained from temporary assignments, we can help.',
      'We use sophisticated database technology to track and match candidates to opportunities. But technology can only go so far. We get to know you personally – your experience and education, as well as your preferences and career goals.',
      'By registering with us you will have confidential access to some of the best administrative assignments and positions available. Our experience in this specialized market enables us to provide guidance with respect to current market demands, the skills employers are seeking, salary levels and other assistance.',
    ],
    findTitle: 'Find your next job!',
    findText: 'Visit our job opportunities to see current openings.',
    meetTitle: 'Meeting with us',
    meetIntro: [
      'If your experience and background is a good match for the types of positions we are currently recruiting for, we will contact you to come in and meet with one of our consultants.',
      'Our meetings are designed to gain insight into your personal and professional aspirations. Where have you been and where do you want to go? What sort of working style do you prefer? Are you interested in large companies with a lot of opportunity for advancement or do you work best in an entrepreneurial environment that allows you to influence operational decisions? Do you thrive on details or prefer to focus on the big picture?',
    ],
    meet: [
      ['A skills test', 'We will assess your skill level using electronic tests that take approximately 30 minutes.'],
      ['References and details', 'We will also gather important administrative information – references, software experience, salary expectations and the like. We want to be sure we have everything we need to help you put your strengths to work in the advancement of your career.'],
      ['When a role fits', 'Based upon the information we have gathered, if a position becomes available where your experience and goals match the specific details requested by the employer, we will contact you to see if the position may be of interest.'],
    ],
    meetNote: 'If you have any questions about registering with us or want to find out more about administrative opportunities or careers, please contact one of our local offices.',
    faq: [
      ['What is the difference between temporary and permanent recruitment?', [
        'Temporary staffing generally refers to temporary assistance that may be required by a company for a variety of reasons including:',
        ['Special projects', 'Parental leaves', 'Peak work periods', 'Sudden position vacancies', 'Vacation coverage', 'Employee leaves of absence'],
        'Temporary staffing allows an employer to meet their immediate staffing needs quickly and flexibly. Additionally, employers may want to consider candidates as potential permanent employees by hiring them on contract first.',
        'In contrast, permanent recruitment refers to a more in-depth search process for a candidate who will be hired directly by the employer on a permanent basis.',
      ]],
      ['What are the benefits of temporary vs permanent employment?', [
        'While many job seekers are looking for the stability that comes with permanent employment, contract employment offers several advantages as well.',
        ['Contract assignments are a great way to expand on your software and industry experience, as well as broaden your professional contacts.', 'The hiring process is much quicker.', 'Some candidates prefer the flexibility and variety provided by contract employment.', 'Should there be potential for permanent, it can be an opportunity to test-drive a company, to see whether it makes sense to accept permanent employment should the company make an offer.', 'In approximately 25% of our assignments, the contract employee is hired permanently by the company.'],
      ]],
      ['I am currently working and my employer is not aware of my job search. How will you ensure confidentiality?', 'We will not present your resume or discuss your career goals with any potential employer without your prior approval. The entire placement process has been designed with a view towards protecting the confidentiality of job candidates. You can depend on our integrity to help maintain yours.'],
      ['Once I am registered with Administrative Staffing, how long will it take to be placed?', [
        'While we place significant emphasis on a candidate’s skills and experience, our primary focus is on “fit” – finding the candidate that fits not only the role, but the company as well.',
        'When an employer calls us with a staffing requirement, we place all our efforts towards finding candidates that will be a great fit for the role and company. Whether it is a one week assignment or a permanent role, we strive to facilitate situations where the candidate and the employer are both happy.',
        'Consequently, we may have the ideal opportunity for you immediately, or it may be some time before the position that’s just right for you becomes available. If any of your file details change after your registration, we encourage you to update us whenever possible.',
      ]],
      ['Will it cost me anything to register with Administrative Staffing?', 'No. All of our fees are paid for by the employer. There is no charge to candidates.'],
      ['What sets Administrative Staffing apart from other recruitment firms?', [
        'First and foremost, we are a specialist firm. Businesses know what we do. Candidates know what we do. By focusing on our area of expertise, we are able to give you access to some of the best administrative positions in the marketplace.',
        'Secondly, we are committed to a personal approach. We use sophisticated technology to track and match candidates to opportunities. However, we believe technology can only go so far. We listen. We get to know our candidates and clients well beyond job descriptions and resumes. We will pay close attention to your personal and professional aspirations and refer you to positions that are suitable should they become available.',
      ]],
    ],
  },

  // About Us  (EXACT)
  about: {
    title: 'Atlantic Canada’s administrative recruitment specialists.',
    text: [
      'We are a specialist recruitment firm based in Atlantic Canada catering to the needs of a broad spectrum of clients throughout the Atlantic Provinces.',
      'Focusing on a wide variety of administrative positions, we assist employers with the candidate search process and meet with qualified candidates looking for that next, great opportunity.',
      'Established in 2006, Administrative Staffing is a division within its parent company, JMS Accountant Staffing Ltd., which began in 2002. Due to ongoing client requests from our Accountant Staffing division for administrative candidates, we started the division holding the same, high standards of service and a specialized focus. This division of recruitment is a wonderful complement to Accountant Staffing and offers our clients one place to get assistance with all their office hiring.',
      'Our business is people. We listen carefully to employers and candidates to understand their needs so that we can match the skills, experience and goals of our candidates with the exact requirements of the employer. It’s all about “fit”.',
    ],
  },

  // Job opportunities  (EXACT: the live page's statement above the listings)
  jobs: {
    inclusion: [
      'Administrative Staffing is committed to promoting diversity and inclusion in the workplace. We believe that it is essential for workforces to reflect the communities they serve, where everyone feels included and valued.',
      'We encourage applications from underrepresented groups including African Canadians, Indigenous/Aboriginal People, Racially Visible Persons, Women, Persons with Disabilities, and 2SLGBTQ+ Persons.',
      'Self-identification is encouraged but not required during the application process and accommodations can be requested during the recruitment process. If accommodations are needed during the assessment process, such as an interview or testing, please let us know and we will make arrangements to meet your needs.',
    ],
  },
};
