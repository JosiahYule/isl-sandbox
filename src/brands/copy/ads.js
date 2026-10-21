// ADMINISTRATIVE STAFFING: THE WORDS ON EACH PAGE, from administrativestaffing.ca (read October 21, 2026).
//
// The live site's wording is the default. Marked in each block:
//   EXACT    copied word for word from the live page
//   CLOSE    the live page's points in the same order, with its own phrases where possible
//   FROM AS  the live ADS page couldn't be read; Accountant Staffing's matching page, with the field changed
// TODO: paste the exact text over CLOSE and FROM AS blocks (Squarespace: Settings > Advanced > Import/Export).

export const copy = {
  // Homepage  (headline EXACT; the live homepage lists accounting roles by mistake, so the roles
  // come from its Job Seekers page; the "why" points are FROM AS, which the ADS summary matched point for point)
  home: {
    h1: ['Focused on staffing', 'administrative positions.'],
    lead: 'We are Atlantic Canada’s specialist recruitment firm for administrative professionals. Junior to senior level, temporary or permanent opportunities, we are here to help.',
    findJob: 'Find your next job!',
    whyTitle: 'Why Choose Administrative Staffing?',
    why: [
      ['Specialization', 'By focusing on our area of expertise, we know the industry, the market, and provide your organization with the most current, professional, and experienced administrative candidates.'],
      ['Quick Turnaround', 'We continuously meet with new candidates and build lasting relationships, allowing us to manage your search quickly and efficiently when you need it most.'],
      ['Contingency Based', 'We are results-driven. You pay no fees unless you hire one of our candidates, so our success is directly tied to yours.'],
      ['Relationships', 'We take a personal approach, getting to know candidates well beyond their resumes to recommend people who will truly thrive in your role.'],
      ['Fit', 'Whether the opportunity is a one-week contract or a permanent role, our focus is always on finding the absolute best candidate for your position and your company culture.'],
    ],
    rolesTitle: 'What our clients are looking for',
    rolesText: [
      'When employers in Atlantic Canada call us for recruitment assistance, we obtain very detailed information about the skills, experience and educational requirements for the position as well as other soft skills that would result in a great match.',
      'Administrative Staffing recruits for administrative roles that are temporary or permanent at all levels including junior, intermediate and senior levels. Examples of roles include:',
    ],
    localTitle: 'Locally Owned & Operated',
    localText: 'Owned and operated in Atlantic Canada, we believe supporting locally owned businesses builds stronger communities for us all.',
    ctaTitle: 'We’d love to hear from you.',
    ctaText: 'Looking for your next opportunity or need staff support?',
  },

  // The roles at each level (from the live Job Seekers page)
  levels: [
    { name: 'Junior', roles: ['Reception', 'Administrative Support', 'Data Entry', 'File Clerk', 'Records Clerk'] },
    { name: 'Intermediate', roles: ['Administrative Coordinator', 'Human Resources Assistant', 'Marketing Assistant', 'Project Administrator', 'Legal Administrator', 'Paralegal'] },
    { name: 'Senior', roles: ['Executive Assistant', 'Office Manager', 'Donor Relations Officer', 'Project Coordinator'] },
  ],

  // Employers  (title and step names EXACT, text CLOSE)
  employers: {
    title: 'Staffing solutions for employers.',
    intro: [
      'Our focus is the placement of temporary and permanent administrative professionals with employers across Atlantic Canada. We match the requirements of each role with the qualifications of each candidate, and our workers can often start within hours.',
      'Temporary placements also offer a smart way to screen prospective employees before you hire them permanently.',
    ],
    approachTitle: 'Our approach',
    approachSub: 'Resources to attract skilled candidates',
    approachText: ['Our experienced recruiters are able to respond quickly to staffing requirements through:'],
    sources: [
      'Our internal database of registered, qualified candidates',
      'Our extensive list of industry and professional contacts',
      'A referral program where top candidates are referred to our organization',
      'Candidates interested in moving to or returning to Atlantic Canada',
      'Responses to job advertisements on our website, recruitment sites and other media',
      'Relationships with job search centres, colleges and universities',
    ],
    processTitle: 'Our process',
    processIntro: '',
    steps: [
      ['To Start', 'We learn about the role and your organization, then define the position, the qualifications and the soft skills it needs. We can also help write the responsibilities and requirements, provide current market salary data and set a timeline.'],
      ['The Search', 'We use our resources to identify the top candidates. Our Recruitment Consultants have administered relevant skills testing with all registered candidates, and interview them about their experience, strengths, weaknesses, education, goals and motivations.'],
      ['The Presentation', 'We present a short-list of candidates and brief you on each one’s competencies, experience, software knowledge, salary expectations and reasons for interest in the role, then arrange interviews with your selection team.'],
      ['Ensuring Success', 'Once you’ve made your selection, we run criminal background checks on candidates receiving offers, notify unsuccessful candidates and take care of the details. For permanent hires, we can help draft the terms and negotiate the offer. For contract roles, the candidate is on our payroll, and we manage payroll, remittances and end-of-contract procedures, with check-ins along the way.'],
    ],
  },

  // Permanent and Temporary Recruitment FAQ  (FROM AS)
  permanent: {
    title: 'Permanent Recruitment FAQ',
    faq: [
      ['How long does it take to fill a position?', 'We meet and register candidates at all levels on an ongoing basis, so we often have suitable candidates in our network already. When we don’t, we run a full search: placing recruitment ads, interviewing candidates on an ongoing basis and contacting relevant industry associations. We can help quickly and within your timeline.'],
      ['How could your search results differ from my own?', 'Time. Reach. Longevity. Recruiting on your own usually means a job ad, which can miss top candidates who aren’t browsing ads, working candidates who avoid ads for confidentiality reasons, and applicants who don’t plan to stay long-term. Our consultants meet people for general career conversations to learn their motivations, dream roles and long-term goals, then suggest the candidates most likely to thrive in your role.'],
      ['Are there any upfront fees?', 'No. We work only on a contingency basis for both contract and permanent searches. You pay only if you hire one of our candidates.'],
      ['How much does the service cost?', 'Permanent recruitment carries a one-time professional fee based on the candidate’s first-year compensation.'],
      ['What happens if the employee does not work out as planned?', 'Permanent searches include a six-month guarantee. If the hire resigns or is dismissed within six months of their start date, we will find a suitable replacement at no additional cost.'],
    ],
  },
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
      'Administrative Staffing focuses solely on recruiting administrative professionals across Atlantic Canada, for permanent roles and temporary assignments.',
      'We use database technology to match candidates to opportunities, and we also get to know each candidate’s background, preferences and goals. Registered candidates get confidential access to administrative roles, and guidance on market demand, in-demand skills and salary levels.',
    ],
    findTitle: 'Find your next job!',
    findText: 'Visit our job opportunities to see current openings.',
    meetTitle: 'Meeting With Us',
    meet: [
      ['A meeting with a consultant', 'If your background fits our current openings, we arrange a meeting to talk about your career history and goals, the way you like to work, and whether you prefer large companies or entrepreneurial settings, detail work or the big picture.'],
      ['A skills assessment', 'Electronic skills tests take about 30 minutes.'],
      ['References and details', 'We also collect your references, software experience and salary expectations.'],
      ['We call when it fits', 'When a role matches your experience and goals, we contact you to see if you’re interested.'],
    ],
    faq: [
      ['What is the difference between temporary and permanent recruitment?', 'Temporary staffing covers needs like special projects, leaves, peak periods, vacancies and vacation coverage. Permanent recruitment is a more in-depth search for a direct hire. Some employers hire contract staff first.'],
      ['What are the benefits of temporary vs permanent employment?', 'Contracts build your software and industry experience and your contacts, and the hiring process is faster. They also let you try a company before accepting permanent work. About 25% of our assignments lead to a permanent hire.'],
      ['I am currently working and my employer is not aware of my job search. How will you ensure confidentiality?', 'We never share your resume or career goals with an employer without your prior approval.'],
      ['Once I am registered with Administrative Staffing, how long will it take to be placed?', 'Placement depends on fit with both the role and the company, so it may happen immediately or take a while. Let us know when your details change.'],
      ['Will it cost me anything to register with Administrative Staffing?', 'No. Our service is free for candidates. Employers pay all fees.'],
      ['What sets Administrative Staffing apart from other recruitment firms?', 'We are specialists, and we take a personal approach: technology alongside listening to what you want from your career.'],
    ],
  },

  // About Us  (FROM AS: the live ADS About page couldn't be read)
  about: {
    title: 'Specialist recruitment for administrative professionals.',
    text: [
      'Administrative Staffing is a specialist recruitment firm for administrative professionals in Atlantic Canada. We help employers fill junior to senior roles, temporary and permanent, from reception to executive assistant.',
      'We began in 2006 as a division of Accountant Staffing, founded in Halifax in 2002, so our clients have one place for all their administrative staffing needs. We serve Nova Scotia, New Brunswick, and Newfoundland & Labrador.',
      'Our business is people. We listen to employers and candidates, and match skills, experience and goals with what employers need. We call it fit.',
    ],
  },
};
