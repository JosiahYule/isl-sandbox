// ACCOUNTANT STAFFING: THE WORDS ON EACH PAGE, from accountantstaffing.ca (read October 21, 2026).
//
// The live site's wording is the default. Marked in each block:
//   EXACT    copied word for word from the live page
//   CLOSE    the live page's points in the same order, with its own phrases where possible.
//            The tool that read these pages wouldn't return them word for word.
//            TODO: paste the exact text over these (Squarespace: Settings > Advanced > Import/Export).

export const copy = {
  // Homepage  (EXACT, except the search label and "Request talent", which are the new site's)
  home: {
    h1: ['Specializing in the placement of', 'accounting and finance professionals.'],
    lead: 'We are Atlantic Canada’s only recruitment firm specializing in the placement of Accounting and Finance professionals. Junior to senior level, temporary or permanent opportunities, we are here to help.',
    findJob: 'Find your next job!',
    whyTitle: 'Why Choose Accountant Staffing?',
    why: [
      ['Specialization', 'By focusing on our area of expertise, we know the industry, the market, and provide your organization with the most current, professional, and experienced accounting and finance candidates.'],
      ['Quick Turnaround', 'We continuously meet with new candidates and build lasting relationships, allowing us to manage your search quickly and efficiently when you need it most.'],
      ['Contingency Based', 'We are results-driven. You pay no fees unless you hire one of our candidates, so our success is directly tied to yours.'],
      ['Relationships', 'We take a personal approach, getting to know candidates well beyond their resumes to recommend people who will truly thrive in your role.'],
      ['Fit', 'Whether the opportunity is a one-week contract or a permanent role, our focus is always on finding the absolute best candidate for your position and your company culture.'],
    ],
    rolesTitle: 'What our clients are looking for',
    rolesText: [
      'When employers in Atlantic Canada call us for recruitment assistance, we obtain very detailed information about the skills, experience and educational requirements for the position as well as other soft skills that would result in a great match.',
      'Accountant Staffing recruits for accounting roles that are temporary or permanent at all levels including junior, intermediate and senior levels. Examples of roles include:',
    ],
    localTitle: 'Locally Owned & Operated',
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
      ['Understanding Your Organization and the Role', 'Determining the person you need for the position and learning about your organization is the first and most critical step in the recruiting process. We require a comprehensive understanding of the responsibilities, experience, personal characteristics and education the ideal candidate must have to be successful in the role.'],
      ['Sourcing Potential Candidates', 'During the search process, we will identify the top candidates for your needs. Recruitment Consultants interview all registered candidates to gain an understanding of their professional experience, accomplishments, strengths and weaknesses, and educational background. We also discuss their goals, ambitions and motivations, so that we can present to you the candidates whom we feel are best suited for your position.'],
      ['Candidate Presentation', 'Once our search is complete and we have determined the best candidates for the role, we present you with a short-list of top candidates. We will brief you on each candidate, reviewing such details as skills and experience, working practices, leadership style, career objectives, salary expectations as well as the reason the candidate is interested in the role. At your convenience, we will arrange for you and others involved in the selection process to interview the desired candidates.'],
      ['Checking References and Testing', 'Comprehensive reference checks of the preferred candidate(s) are completed for your review. A thorough understanding of the candidate’s performance and characteristics in past roles is achieved through completing this process. With exception to fully designated Chartered Professional Accountants (CPA), each registered candidate has taken an accounting test that matches their level of expertise. Designation verification is completed for designated Accountants. A criminal background check is also completed for the successful candidate with results forwarded to you for your records.'],
      ['Final Step', 'Once you have selected the best person for the position, we take care of the remaining details. For permanent roles, we can assist you with drafting the terms of employment and finalizing the job offer. We act as an intermediary, negotiating on your behalf. We notify all unsuccessful candidates of the outcome and can assist with first day details. In the case of a temporary hire, we manage all necessary documentation including payroll, employee remittances and contract termination procedures at the end of the work period. As well, we will touch base with you and the contractor periodically throughout the contract.'],
    ],
  },

  // Permanent Recruitment FAQ  (questions EXACT, answers CLOSE)
  permanent: {
    title: 'Permanent Recruitment FAQ',
    faq: [
      ['How long does it take to fill a position?', 'As a local accounting recruiter, we meet and register candidates at all levels on an ongoing basis, so we often have suitable candidates in our network already. When we don’t, we run a full search: placing recruitment ads, interviewing candidates on an ongoing basis and contacting relevant industry associations. We can help quickly and within your timeline.'],
      ['How could your search results differ from my own?', 'Time. Reach. Longevity. Recruiting on your own usually means a job ad, which can miss top candidates who aren’t browsing ads, working candidates who avoid ads for confidentiality reasons, and applicants who don’t plan to stay long-term. Our consultants meet people for general career conversations to learn their motivations, dream roles and long-term goals, then suggest the candidates most likely to thrive in your role.'],
      ['Are there any upfront fees?', 'No. We work only on a contingency basis for both contract and permanent searches. You pay only if you hire one of our candidates.'],
      ['How much does the service cost?', 'Permanent recruitment carries a one-time professional fee based on the candidate’s first-year compensation.'],
      ['What happens if the employee does not work out as planned?', 'Permanent searches include a six-month guarantee. If the hire resigns or is dismissed within six months of their start date, we will find a suitable replacement at no additional cost.'],
    ],
  },

  // Temporary Recruitment FAQ  (questions EXACT, answers CLOSE; two phrases EXACT)
  temporary: {
    title: 'Temporary Recruitment FAQ',
    faq: [
      ['What types of temporary roles do you fill?', 'Temporary staffing allows you to meet your immediate staffing needs quickly and flexibly: special projects, parental leaves, peak periods, sudden vacancies, vacation coverage and employee leaves of absence. It’s also a way to evaluate a contractor as a possible permanent hire.'],
      ['How long does it take to fill a position?', 'Every candidate goes through skills testing, an in-depth interview and reference checks before registering with us, so our contractors are ready to go at a moment’s notice.'],
      ['Can I determine the length of a contract?', 'Yes. An approximate length helps at the outset, but you can end the contract at any time without penalty, or extend it if the contractor is still available.'],
      ['Do contract employees ever become permanent?', 'Often. Clients regularly hire contractors permanently during or after the contract, once they’ve seen how they fit.'],
      ['Are there any upfront fees?', 'No. Our services are contingency based, so you pay a fee only if you hire one of our candidates.'],
      ['How much does the service cost?', 'The fee is included in an all-inclusive hourly rate that covers the contractor’s salary, employer EI and CPP contributions, payroll processing and staffing fees. The rate depends on the level of the position and the contractor’s experience and skills.'],
      ['What happens if the contractor does not work out?', 'We will source replacement candidates, or you can end the contract.'],
    ],
  },

  // Job Seekers  (headings and questions EXACT, text CLOSE)
  seekers: {
    title: 'Job placement solutions for workers.',
    intro: [
      'Accountant Staffing focuses solely on recruiting accounting and finance professionals across Atlantic Canada, for permanent roles and temporary assignments.',
      'We use database technology to match candidates to opportunities, and we also get to know each candidate’s experience, education, preferences and goals. Registered candidates get confidential access to accounting and finance roles, and guidance on market demand, in-demand skills, salary levels and professional accounting programs.',
    ],
    findTitle: 'Find your next job!',
    findText: 'Visit our job opportunities to see current openings.',
    meetTitle: 'Meeting With Us',
    meet: [
      ['A meeting with a consultant', 'If your background fits our current openings, a consultant invites you to meet and talk about your career goals, working style and preferences.'],
      ['A skills test', 'Candidates without a professional accounting designation take an electronic skills test of about 30 minutes.'],
      ['References and details', 'We also collect your references, software experience and salary expectations.'],
      ['Your resume on file', 'If there’s no match right now, we keep your resume on file and contact you when there is.'],
    ],
    faq: [
      ['What is the difference between temporary and permanent recruitment?', 'Temporary staffing covers needs like leaves, peak periods and special projects. Permanent recruitment is a more in-depth search for a direct hire. Some contract roles lead to permanent hires: about 25% of our assignments.'],
      ['What are the benefits of temporary vs permanent employment?', 'Contract work builds your software and industry experience and your contacts. It moves faster, offers flexibility, and lets you “test-drive” a company.'],
      ['How much experience do employers require for junior level roles?', 'Roughly 6 to 12 months of accounting support or data entry experience may be enough.'],
      ['I am currently working and my employer is not aware of my job search. How will you ensure confidentiality?', 'We never share your resume or career goals with an employer without your approval.'],
      ['Once I am registered with Accountant Staffing, how long will it take to be placed?', 'It depends on the roles available. It may be immediate, or it may take some time.'],
      ['Will it cost me anything to register with Accountant Staffing?', 'No. Our service is free for candidates. Employers pay all fees.'],
      ['I would like to relocate to Nova Scotia in the near future. Can I contact your organization to discuss my career interests prior to my arrival?', 'Yes. Email your resume and a short summary to apply@accountantstaffing.com, or call 902-491-1301.'],
      ['What sets Accountant Staffing apart from other recruitment firms?', 'We specialize in accounting and finance, and we take a personal approach that goes beyond job descriptions and resumes.'],
    ],
  },

  // About Us  (headline EXACT, text CLOSE)
  about: {
    title: 'The only financial recruitment specialists.',
    text: [
      'Accountant Staffing is the only specialist recruitment firm in Atlantic Canada focused on accounting and finance. We help Atlantic Canadian employers fill junior to senior roles, temporary and permanent, from junior accounting clerk to CFO.',
      'Founded in 2002 and headquartered in Halifax, Nova Scotia, we serve Nova Scotia, New Brunswick, and Newfoundland & Labrador. Our consultants know the regional accounting market and have relationships with professionals across the region and beyond.',
      'In 2006 we added Administrative Staffing, a division for general office hiring, so our clients have one place for all their administrative staffing needs.',
      'Our business is people. We listen to employers and candidates, and match skills, experience and goals with what employers need. We call it fit.',
    ],
  },
};
