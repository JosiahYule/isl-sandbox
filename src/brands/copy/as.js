// ACCOUNTANT STAFFING: THE WORDS ON EACH PAGE, from accountantstaffing.ca.
//
// Word for word from the live pages (read in the browser, October 30, 2026), with three kinds of change:
//   - headings, menu labels and buttons in sentence case, as on ISL's site
//   - curly quotes and apostrophes
//   - the two em dashes on the live FAQ pages became a colon and a full stop
// An FAQ answer can be a string, or a list of paragraphs where a nested list is a bulleted list.

export const copy = {
  // Homepage  (EXACT, except the search label and "Request talent", which are the new site's)
  home: {
    h1: ['Specializing in the placement of', 'accounting and finance professionals.'],
    lead: 'We are Atlantic Canada’s only recruitment firm specializing in the placement of Accounting and Finance professionals. Junior to senior level, temporary or permanent opportunities, we are here to help.',
    findJob: 'Find your next job!',
    whyTitle: 'Why choose Accountant Staffing?',
    why: [
      ['Specialization', 'By focusing on our area of expertise, we know the industry, the market, and provide your organization with the most current, professional, and experienced accounting and finance candidates.'],
      ['Quick turnaround', 'We continuously meet with new candidates and build lasting relationships, allowing us to manage your search quickly and efficiently when you need it most.'],
      ['Contingency based', 'We are results-driven. You pay no fees unless you hire one of our candidates, so our success is directly tied to yours.'],
      ['Relationships', 'We take a personal approach, getting to know candidates well beyond their resumes to recommend people who will truly thrive in your role.'],
      ['Fit', 'Whether the opportunity is a one-week contract or a permanent role, our focus is always on finding the absolute best candidate for your position and your company culture.'],
    ],
    rolesTitle: 'What our clients are looking for',
    rolesText: [
      'When employers in Atlantic Canada call us for recruitment assistance, we obtain very detailed information about the skills, experience and educational requirements for the position as well as other soft skills that would result in a great match.',
      'Accountant Staffing recruits for accounting roles that are temporary or permanent at all levels including junior, intermediate and senior levels. Examples of roles include:',
    ],
    localTitle: 'Locally owned and operated',
    localText: 'Owned and operated in Atlantic Canada, we believe supporting locally owned businesses builds stronger communities for us all.',
    ctaTitle: 'We’d love to hear from you.',
    ctaText: 'Looking for your next opportunity or need staff support?',
  },

  // The roles at each level (EXACT, homepage list)
  levels: [
    { name: 'Junior', roles: ['Junior & Senior Accounting Clerks', 'Junior Accountant', 'Accounting Technician', 'Accounts Payable / Accounts Receivable Specialist', 'Payroll Clerk', 'Tax Clerk', 'Data Entry Clerk'] },
    { name: 'Intermediate', roles: ['General Accountant', 'Property Accountant', 'Bookkeeper', 'Office Manager', 'Financial Analyst / Budget Analyst', 'AR/AP Supervisor', 'Payroll Specialist', 'Part-time Bookkeeper', 'Procurement Manager'] },
    { name: 'Senior', roles: ['CFO', 'VP Finance', 'Director of Finance', 'Controller', 'Accounting Manager', 'Assistant Controller', 'Senior Level Accountant', 'Senior Financial Analyst', 'Internal Auditor', 'Financial Reporting Officer'] },
  ],

  // Employers  (EXACT)
  employers: {
    title: 'Staffing solutions for employers.',
    intro: [
      'What’s in a name? In our case… everything. At Accountant Staffing, our sole focus is the recruitment and placement of the most talented permanent or temporary accounting professionals. Years of experience enables us to deliver professional results. Fast.',
      'The Accountant Staffing team will work with you to develop an understanding of your operations and find you the right worker for the job. Our unmatched flexibility and convenience offers a smart way to screen prospective employees before integrating them into your team.',
    ],
    approachTitle: 'Our approach',
    approachSub: 'Resources to attract skilled candidates',
    approachText: [
      'We use extensive resources to attract skilled candidates who are actively searching for new opportunities as well as those who are not actively looking, but are open to opportunities presented to them.',
      'We have built a reputation for consistently providing high quality recruitment services to our clients. Our experienced recruiters are able to respond quickly to staffing requirements through:',
    ],
    sources: [
      'Our internal database of registered, qualified candidates',
      'Our extensive list of industry and professional contacts',
      'A referral program where top candidates are referred to our organization',
      'Candidates interested in moving to or returning to Atlantic Canada',
      'Responses to ongoing job advertisements across our website, job boards, professional networks, and social media channels',
    ],
    processTitle: 'Our process',
    processIntro: 'We will work closely with you at each stage of the search process, keeping you updated and receiving your feedback throughout.',
    steps: [
      ['Understanding your organization and the role', 'Determining the person you need for the position and learning about your organization is the first and most critical step in the recruiting process. We require a comprehensive understanding of the responsibilities, experience, personal characteristics and education the ideal candidate must have to be successful in the role.'],
      ['Sourcing potential candidates', 'During the search process, we will identify the top candidates for your needs. Recruitment Consultants interview all registered candidates to gain an understanding of their professional experience, accomplishments, strengths and weaknesses, and educational background. We also discuss their goals, ambitions and motivations, so that we can present to you the candidates whom we feel are best suited for your position.'],
      ['Candidate presentation', 'Once our search is complete and we have determined the best candidates for the role, we present you with a short-list of top candidates. We will brief you on each candidate, reviewing such details as skills and experience, working practices, leadership style, career objectives, salary expectations as well as the reason the candidate is interested in the role. At your convenience, we will arrange for you and others involved in the selection process to interview the desired candidates.'],
      ['Checking references and testing', 'Comprehensive reference checks of the preferred candidate(s) are completed for your review. A thorough understanding of the candidate’s performance and characteristics in past roles is achieved through completing this process. With exception to fully designated Chartered Professional Accountants (CPA), each registered candidate has taken an accounting test that matches their level of expertise. Designation verification is completed for designated Accountants. A criminal background check is also completed for the successful candidate with results forwarded to you for your records.'],
      ['Final step', 'Once you have selected the best person for the position, we take care of the remaining details. For permanent roles, we can assist you with drafting the terms of employment and finalizing the job offer. We act as an intermediary, negotiating on your behalf. We notify all unsuccessful candidates of the outcome and can assist with first day details. In the case of a temporary hire, we manage all necessary documentation including payroll, employee remittances and contract termination procedures at the end of the work period. As well, we will touch base with you and the contractor periodically throughout the contract.'],
    ],
  },

  // Permanent Recruitment FAQ  (questions and answers EXACT)
  permanent: {
    title: 'Permanent recruitment FAQ',
    faq: [
      ['How long does it take to fill a position?', [
        'As a local firm specializing in accounting recruitment, we meet with and register candidates at all levels on an ongoing basis. The result is a strong network of contacts in our industry and the ability to assist employers with their recruitment needs quickly and within their timeline.',
        'While we are often able to find the perfect candidates for your position in our current network, we also perform a full search to source additional candidates including development and placement of recruitment ads, ongoing interviews with prospective candidates, and reaching out to industry associations relevant to your business.',
      ]],
      ['How could your search results differ from my own?', [
        'Time. Reach. Longevity.',
        'When an employer needs an employee they want to find the absolute best person for their company. When recruiting on their own, employers typically place an ad and rely on that ad to attract the candidates they need. Unfortunately, all the top candidates may not be looking at employment ads on an ongoing basis. Working candidates may not reply to general ads due to confidentiality concerns or non-working people may be applying to positions where they know they will not be staying for the long-term.',
        'Our consultants meet with people at all levels for general meetings that allow us to get a true sense of where that person wants to be in their career. What motivates the candidate, what is their dream job and where they see themselves long-term are topics explored. With this information, we are able to make informed suggestions of people who we think will be happy and thrive in your role. It’s a win-win.',
      ]],
      ['Are there any upfront fees?', 'No. We work only on a contingency basis. Whether you require a contract accountant or would like to engage our services to complete a permanent search, you pay a fee only if you hire one of our candidates.'],
      ['How much does the service cost?', 'For permanent recruitment, we charge a one-time professional fee based on the candidate’s first-year compensation.'],
      ['What happens if the employee does not work out as planned?', 'Occasionally an employee does not work out or decides to move on to another position. For permanent searches we provide a six month guarantee so that should the individual resign or be dismissed within six months of the start date of employment, we will find a suitable replacement at no additional cost.'],
    ],
  },

  // Temporary Recruitment FAQ  (questions and answers EXACT)
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
      ['Are there any upfront fees?', 'No. We work only on a contingency basis. Whether you require a contract accountant or would like to engage our services to complete a permanent search, you pay a fee only if you hire one of our candidates.'],
      ['How much does the service cost?', 'On a temporary staffing basis, our fee is built into an hourly rate which includes all costs: the contractor’s salary, employer EI and CPP benefits, payroll processing costs and contract staffing fees. The hourly rate depends on the level of position and the individual contractor’s experience and skills.'],
      ['What happens if the contractor does not work out?', 'Occasionally a contractor does not work out or decides to move on to another position. If this happens, we will source new contractor candidates to consider as replacements. Alternatively, you may choose to end the contract.'],
    ],
  },

  // Job Seekers  (EXACT; the meeting paragraphs are split into steps, in the live order)
  seekers: {
    title: 'Job placement solutions for workers.',
    intro: [
      'At Accountant Staffing, our sole focus is the recruitment and placement of talented accounting and finance professionals throughout Atlantic Canada.',
      'Whether you are looking for a permanent career change or the flexibility and experience that can be gained from temporary assignments, we can help.',
      'We use sophisticated database technology to track and match candidates to opportunities. But technology can only go so far. We get to know you personally – your experience and education, as well as your preferences and career goals.',
      'By registering with us you will have confidential access to some of the best accounting and finance assignments and positions available. Our experience in this specialized market enables us to provide guidance with respect to current market demands, the skills employers are seeking, salary levels and professional accounting programs.',
    ],
    findTitle: 'Find your next job!',
    findText: 'Visit our job opportunities to see current openings.',
    meetTitle: 'Meeting with us',
    meetIntro: [
      'If your experience and background is a good match for the types of positions we are currently recruiting for, we will contact you to come in and meet with one of our consultants.',
      'Our meetings are designed to gain insight into your personal and professional aspirations. Where have you been and where do you want to go? What sort of working style do you prefer? Are you interested in large companies with a lot of opportunity for advancement or do you work best in an entrepreneurial environment that allows you to influence operational decisions? Do you thrive on details or prefer to focus on the big picture?',
    ],
    meet: [
      ['A skills test', 'If you have not completed a professional accounting designation, we will assess your level of accounting knowledge using an electronic test that takes approximately 30 minutes.'],
      ['References and details', 'We will also gather important administrative information – references, software experience, salary expectations and the like. We want to be sure we have everything we need to help you put your strengths to work in the advancement of your career.'],
      ['When a role fits', 'Based upon the information we have gathered, if a position becomes available where your experience and goals match the specific details requested by the employer, we will contact you to see if the position may be of interest.'],
      ['Your resume on file', 'We will review your information and if there may be a suitable role available right away or likely to become available in the near future, we will schedule an immediate meeting. Otherwise, we will keep your resume on file and contact you should we require further information.'],
    ],
    meetNote: 'If you have any questions about registering with us or want to find out more about accounting opportunities or careers, please contact us by calling one of our local offices.',
    faq: [
      ['What is the difference between temporary and permanent recruitment?', [
        'Temporary staffing generally refers to temporary assistance that may be required by a company for a variety of reasons including:',
        ['Special projects', 'Parental leaves', 'Peak work periods', 'Sudden position vacancies', 'Vacation coverage', 'Employee leaves of absence'],
        'Temporary staffing allows an employer to meet their immediate staffing needs quickly and flexibly. Additionally, employers may want to consider candidates as potential permanent employees by hiring them on contract first.',
        'In contrast, permanent recruitment refers to a more in-depth search process for a candidate who will be hired directly by the employer on a permanent basis.',
      ]],
      ['What are the benefits of temporary vs permanent employment?', [
        'While many job seekers are looking for the stability that comes with permanent employment, contract employment offers several advantages as well.',
        ['Contract assignments are a great way to expand on your software and industry experience, as well as broaden your professional contacts', 'The hiring process is much quicker', 'Some candidates prefer the flexibility and variety provided by contract employment', 'Should there be potential for permanent, it can be an opportunity to test-drive a company, to see whether it makes sense to accept permanent employment should the company make an offer', 'In approximately 25% of our assignments, the contract employee is hired permanently by the company'],
      ]],
      ['How much experience do employers require for junior level roles?', 'We are always interested in speaking with candidates at all levels who have had the opportunity to gain accounting experience. For junior level roles, this accounting support or data entry experience may only be 6-12 months, but it has given you the opportunity to work in an office setting and gain hands-on experience.'],
      ['I am currently working and my employer is not aware of my job search. How will you ensure confidentiality?', 'We will not present your resume or discuss your career goals with any potential employer without your prior approval. The entire placement process has been designed with a view towards protecting the confidentiality of job candidates. You can depend on our integrity to help maintain yours.'],
      ['Once I am registered with Accountant Staffing, how long will it take to be placed?', [
        'When an employer calls us with a staffing requirement, we place all our efforts towards finding candidates that will be a great fit for the role and company. Whether it is a one week assignment or a permanent role, we strive to facilitate situations where the candidate and the employer are both happy.',
        'Consequently, we may have the ideal opportunity for you immediately, or it may be some time before the position that’s just right for you becomes available. If any of your file details change after your registration, we encourage you to update us whenever possible.',
      ]],
      ['Will it cost me anything to register with Accountant Staffing?', 'No. All of our fees are paid for by the employer. There is no charge to candidates.'],
      ['I would like to relocate to Nova Scotia in the near future. Can I contact your organization to discuss my career interests prior to my arrival?', 'Yes. If you are an accounting or finance professional looking for a new career opportunity in Nova Scotia, we would be pleased to hear from you. Please send your resume to apply@accountantstaffing.com. Include a brief summary outlining what you are looking for, your availability, your minimum salary expectations and any other preliminary information that you consider important. If you would like to speak with a recruitment specialist, please call us at 902.491.1301. We would be happy to provide more information.'],
      ['What sets Accountant Staffing apart from other recruitment firms?', [
        'First and foremost, we are a specialist firm. Businesses know what we do. Candidates know what we do. By focusing on our area of expertise, we are able to give you access to some of the best accounting and financing positions in the marketplace.',
        'Secondly, we are committed to a personal approach. We use sophisticated technology to track and match candidates to opportunities. However, we believe technology can only go so far. We listen. We get to know our candidates and clients well beyond job descriptions and resumes. We will pay close attention to your personal and professional aspirations and refer you to positions that are suitable should they become available.',
      ]],
    ],
  },

  // About Us  (EXACT)
  about: {
    title: 'The only financial recruitment specialists.',
    text: [
      'Accountant Staffing is the only specialist recruitment firm in Atlantic Canada focusing on accounting and finance positions.',
      'We assist Atlantic Canadian employers with junior to senior level and temporary or permanent staffing requirements. So whatever your staffing requirements from Junior Accounting Clerk to CFO – we are here to help.',
      'Established in 2002, Accountant Staffing is headquartered in Halifax, Nova Scotia and offers recruitment services throughout Nova Scotia, New Brunswick, and Newfoundland & Labrador. Our Consultants have current knowledge in every aspect of the accounting market in Atlantic Canada and have developed relationships with accounting professionals throughout our region and beyond.',
      'Over time, we recognized the need for an administrative staffing division that held the same, high standards of service and a specialized focus. Therefore, in 2006, we began Administrative Staffing. This division of recruitment is a wonderful complement to Accountant Staffing and offers our clients one place to get assistance with all their office hiring.',
      'Our business is people. We listen carefully to employers and candidates to understand their needs so that we can match the skills, experience and goals of our candidates with the exact requirements of the employer. It’s all about “fit”.',
    ],
  },

  // Job opportunities  (EXACT: the live page's statement above the listings)
  jobs: {
    inclusion: [
      'Accountant Staffing is committed to promoting diversity and inclusion in the workplace. We believe that it is essential for workforces to reflect the communities they serve, where everyone feels included and valued. We promote environments that value and respect all individuals, regardless of their race, ethnicity, gender, sexual orientation, age, ability, religion, or any other personal characteristic.',
      'We encourage applications from underrepresented groups including African Canadians, Indigenous/Aboriginal People, Racially Visible Persons, Women, Persons with Disabilities, and 2SLGBTQ+ Persons.',
      'Self-identification is encouraged but not required during the application process and accommodations can be requested during the recruitment process. If accommodations are needed during the assessment process, such as an interview or testing, please let us know and we will make arrangements to meet your needs.',
    ],
  },
};
