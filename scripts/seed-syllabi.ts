import { db } from '../server/db';
import { subjectSyllabi, SyllabusUnit } from '../shared/schema';
import { eq } from 'drizzle-orm';

const biologyCurriculum: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "The Chemistry of Life",
    chapters: [
      { chapterNumber: 1, chapterTitle: "The Study of Life", topic: "The Study of Life", alternativeTopic: "The Study of Life: A Biblical Creationist Perspective" },
      { chapterNumber: 2, chapterTitle: "The Chemical Foundation of Life", topic: "The Chemical Foundation of Life" },
      { chapterNumber: 3, chapterTitle: "Biological Macromolecules", topic: "Biological Macromolecules" },
      { chapterNumber: 4, chapterTitle: "Cell Structure", topic: "Cell Structure" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "The Cell",
    chapters: [
      { chapterNumber: 5, chapterTitle: "Structure and Function of Plasma Membranes", topic: "Plasma Membranes" },
      { chapterNumber: 6, chapterTitle: "Metabolism", topic: "Cellular Metabolism" },
      { chapterNumber: 7, chapterTitle: "Cellular Respiration", topic: "Cellular Respiration" },
      { chapterNumber: 8, chapterTitle: "Photosynthesis", topic: "Photosynthesis" },
      { chapterNumber: 9, chapterTitle: "Cell Communication", topic: "Cell Communication" },
      { chapterNumber: 10, chapterTitle: "Cell Reproduction", topic: "Cell Division" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Genetics",
    chapters: [
      { chapterNumber: 11, chapterTitle: "Meiosis and Sexual Reproduction", topic: "Meiosis and Sexual Reproduction" },
      { chapterNumber: 12, chapterTitle: "Mendel's Experiments and Heredity", topic: "Mendelian Genetics" },
      { chapterNumber: 13, chapterTitle: "Modern Understandings of Inheritance", topic: "Modern Genetics and Inheritance" },
      { chapterNumber: 14, chapterTitle: "DNA Structure and Function", topic: "DNA Structure and Function" },
      { chapterNumber: 15, chapterTitle: "Genes and Proteins", topic: "Protein Synthesis" },
      { chapterNumber: 16, chapterTitle: "Gene Regulation", topic: "Gene Regulation" },
      { chapterNumber: 17, chapterTitle: "Biotechnology and Genomics", topic: "Biotechnology and Genomics" },
    ],
  },
  {
    unitNumber: 4,
    unitTitle: "Origins and Diversity of Life",
    chapters: [
      { chapterNumber: 18, chapterTitle: "Evolution and the Origin of Species", topic: "Evolution and Natural Selection", alternativeTopic: "Intelligent Design and the Biblical Account of Species Origins" },
      { chapterNumber: 19, chapterTitle: "The Evolution of Populations", topic: "Population Genetics and Microevolution", alternativeTopic: "Variation and Adaptation Within Created Kinds" },
      { chapterNumber: 20, chapterTitle: "Phylogenies and the History of Life", topic: "Phylogenetics and Classification", alternativeTopic: "Baraminology: Classifying Life by Created Kinds" },
      { chapterNumber: 21, chapterTitle: "Viruses", topic: "Viruses and Viral Replication" },
      { chapterNumber: 22, chapterTitle: "Prokaryotes: Bacteria and Archaea", topic: "Bacteria and Archaea" },
    ],
  },
  {
    unitNumber: 5,
    unitTitle: "Biological Diversity",
    chapters: [
      { chapterNumber: 23, chapterTitle: "Protists", topic: "Protists and Eukaryotic Diversity" },
      { chapterNumber: 24, chapterTitle: "Fungi", topic: "Fungi Biology" },
      { chapterNumber: 25, chapterTitle: "Seedless Plants", topic: "Seedless Plants" },
      { chapterNumber: 26, chapterTitle: "Seed Plants", topic: "Seed Plants" },
      { chapterNumber: 27, chapterTitle: "Introduction to Animal Diversity", topic: "Animal Diversity Overview" },
      { chapterNumber: 28, chapterTitle: "Invertebrates", topic: "Invertebrate Animals" },
      { chapterNumber: 29, chapterTitle: "Vertebrates", topic: "Vertebrate Animals" },
    ],
  },
  {
    unitNumber: 6,
    unitTitle: "Plant Structure and Function",
    chapters: [
      { chapterNumber: 30, chapterTitle: "Plant Form and Physiology", topic: "Plant Structure and Physiology" },
      { chapterNumber: 31, chapterTitle: "Soil and Plant Nutrition", topic: "Plant Nutrition and Soil" },
      { chapterNumber: 32, chapterTitle: "Plant Reproduction", topic: "Plant Reproduction" },
    ],
  },
  {
    unitNumber: 7,
    unitTitle: "Animal Structure and Function",
    chapters: [
      { chapterNumber: 33, chapterTitle: "The Animal Body: Basic Form and Function", topic: "Animal Body Organization" },
      { chapterNumber: 34, chapterTitle: "Animal Nutrition and the Digestive System", topic: "Nutrition and Digestion" },
      { chapterNumber: 35, chapterTitle: "The Nervous System", topic: "The Nervous System" },
      { chapterNumber: 36, chapterTitle: "Sensory Systems", topic: "Sensory Systems" },
      { chapterNumber: 37, chapterTitle: "The Endocrine System", topic: "The Endocrine System" },
      { chapterNumber: 38, chapterTitle: "The Musculoskeletal System", topic: "Muscles and Skeleton" },
      { chapterNumber: 39, chapterTitle: "The Respiratory System", topic: "Respiratory System" },
      { chapterNumber: 40, chapterTitle: "The Circulatory System", topic: "Circulatory System" },
      { chapterNumber: 41, chapterTitle: "Osmotic Regulation and Excretion", topic: "Excretory System" },
      { chapterNumber: 42, chapterTitle: "The Immune System", topic: "The Immune System" },
      { chapterNumber: 43, chapterTitle: "Animal Reproduction and Development", topic: "Animal Reproduction" },
    ],
  },
  {
    unitNumber: 8,
    unitTitle: "Ecology",
    chapters: [
      { chapterNumber: 44, chapterTitle: "Ecology and the Biosphere", topic: "Ecology and the Biosphere" },
      { chapterNumber: 45, chapterTitle: "Population and Community Ecology", topic: "Population Ecology" },
      { chapterNumber: 46, chapterTitle: "Ecosystems", topic: "Ecosystems and Energy Flow" },
      { chapterNumber: 47, chapterTitle: "Conservation Biology and Biodiversity", topic: "Conservation Biology" },
    ],
  },
];

const historyCurriculum: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Meeting of Three Worlds (Prehistory–1500)",
    chapters: [
      { chapterNumber: 1, chapterTitle: "The Americas, Europe, and Africa Before 1492", topic: "Pre-Columbian Americas, Europe, and Africa", alternativeTopic: "The Americas, Europe, and Africa Before 1492: A Traditional Perspective" },
      { chapterNumber: 2, chapterTitle: "Early Globalization: The Atlantic World, 1492–1650", topic: "Early Atlantic Exploration and Trade", alternativeTopic: "European Exploration and the Colonial Mission" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Colonial Society, 1500–1763",
    chapters: [
      { chapterNumber: 3, chapterTitle: "Creating New Social Orders: Colonial Societies, 1500–1700", topic: "Colonial American Society" },
      { chapterNumber: 4, chapterTitle: "Rule Britannia! The English Empire, 1660–1763", topic: "British Colonial Empire" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Creating a New Nation, 1754–1800",
    chapters: [
      { chapterNumber: 5, chapterTitle: "Imperial Reforms and Colonial Protests, 1763–1774", topic: "Colonial Resistance and the Road to Revolution" },
      { chapterNumber: 6, chapterTitle: "America's War for Independence, 1775–1783", topic: "The American Revolutionary War" },
      { chapterNumber: 7, chapterTitle: "Creating Republican Governments, 1776–1790", topic: "Founding the American Republic" },
      { chapterNumber: 8, chapterTitle: "Growing Pains: The New Republic, 1790–1820", topic: "The Early American Republic" },
    ],
  },
  {
    unitNumber: 4,
    unitTitle: "A Fluid National Identity, 1800–1848",
    chapters: [
      { chapterNumber: 9, chapterTitle: "Industrial Transformation in the North, 1800–1850", topic: "The Industrial Revolution in America" },
      { chapterNumber: 10, chapterTitle: "Jacksonian Democracy, 1820–1840", topic: "Jacksonian Democracy and Westward Expansion" },
      { chapterNumber: 11, chapterTitle: "A Nation on the Move: Westward Expansion, 1800–1860", topic: "Westward Expansion and Manifest Destiny", alternativeTopic: "Westward Expansion: A Traditional Perspective on Providence and Settlement" },
      { chapterNumber: 12, chapterTitle: "Cotton is King: The Antebellum South, 1800–1860", topic: "The Antebellum South and Slavery" },
      { chapterNumber: 13, chapterTitle: "Antebellum Idealism and Reform Impulses, 1820–1860", topic: "Antebellum Reform Movements" },
    ],
  },
  {
    unitNumber: 5,
    unitTitle: "Tensions Leading to Civil War, 1844–1861",
    chapters: [
      { chapterNumber: 14, chapterTitle: "Troubled Times: The Tumultuous 1850s", topic: "The 1850s: Road to Civil War" },
      { chapterNumber: 15, chapterTitle: "The Civil War, 1860–1865", topic: "Causes and Outbreak of the Civil War" },
    ],
  },
  {
    unitNumber: 6,
    unitTitle: "The Civil War and Reconstruction, 1860–1877",
    chapters: [
      { chapterNumber: 16, chapterTitle: "The Era of Reconstruction, 1865–1877", topic: "Reconstruction After the Civil War", alternativeTopic: "Reconstruction: A Traditional Southern Perspective" },
      { chapterNumber: 17, chapterTitle: "Go West Young Man! Westward Expansion, 1840–1900", topic: "The American West and the Frontier" },
    ],
  },
  {
    unitNumber: 7,
    unitTitle: "The New Industrial Age, 1870–1900",
    chapters: [
      { chapterNumber: 18, chapterTitle: "Industrialization and the Rise of Big Business, 1870–1900", topic: "The Gilded Age and Industrialization" },
      { chapterNumber: 19, chapterTitle: "The Growing Pains of Urbanization, 1870–1900", topic: "Urbanization and Immigration in the Gilded Age" },
      { chapterNumber: 20, chapterTitle: "Political Corruption in Postbellum America", topic: "Gilded Age Politics and Corruption" },
    ],
  },
  {
    unitNumber: 8,
    unitTitle: "The Progressive Era, 1890–1929",
    chapters: [
      { chapterNumber: 21, chapterTitle: "Leading the Way: The Progressive Movement, 1890–1920", topic: "The Progressive Movement" },
      { chapterNumber: 22, chapterTitle: "Age of Empire: American Foreign Policy, 1890–1914", topic: "American Imperialism and Foreign Policy" },
      { chapterNumber: 23, chapterTitle: "Americans and the Great War, 1914–1919", topic: "World War I and America" },
      { chapterNumber: 24, chapterTitle: "The Jazz Age: Redefining the Nation, 1919–1929", topic: "The Roaring Twenties" },
    ],
  },
  {
    unitNumber: 9,
    unitTitle: "Crisis and Achievement, 1929–1945",
    chapters: [
      { chapterNumber: 25, chapterTitle: "Brother, Can You Spare a Dime? The Great Depression, 1929–1932", topic: "The Great Depression" },
      { chapterNumber: 26, chapterTitle: "Franklin Roosevelt and the New Deal, 1932–1941", topic: "The New Deal" },
      { chapterNumber: 27, chapterTitle: "Fighting the Good Fight: World War II, 1941–1945", topic: "World War II" },
    ],
  },
  {
    unitNumber: 10,
    unitTitle: "Post-War Prosperity and Cold War Fears, 1945–1960",
    chapters: [
      { chapterNumber: 28, chapterTitle: "Post-War Prosperity and Cold War Fears, 1945–1960", topic: "The Early Cold War" },
      { chapterNumber: 29, chapterTitle: "Contesting Futures: America in the 1960s", topic: "The 1960s: Civil Rights and Social Change" },
    ],
  },
  {
    unitNumber: 11,
    unitTitle: "The Tumultuous Sixties and Seventies, 1960–1980",
    chapters: [
      { chapterNumber: 30, chapterTitle: "Vietnam and the Crisis of Authority", topic: "The Vietnam War" },
      { chapterNumber: 31, chapterTitle: "A Nation in Transition: Business, Labor, and Politics in the 1970s", topic: "The 1970s: Watergate, Oil Crisis, and Social Change" },
    ],
  },
  {
    unitNumber: 12,
    unitTitle: "Conservatism and Globalization, 1980–2000",
    chapters: [
      { chapterNumber: 32, chapterTitle: "The Reagan Revolution", topic: "The Reagan Era and Conservatism", alternativeTopic: "Reagan and the Conservative Restoration: A Traditional View" },
      { chapterNumber: 33, chapterTitle: "New Millennium Approaches, 1990–2000", topic: "The 1990s: End of the Cold War and Globalization" },
    ],
  },
];

interface CourseMetadata {
  subject: string;
  units: SyllabusUnit[];
  bookTitle: string;
  bookSubtitle: string;
  description: string;
  targetAudience: string;
  scope: string;
}

const FULL_TOC_COURSES: CourseMetadata[] = [
  {
    subject: 'biology',
    units: biologyCurriculum,
    bookTitle: 'Biology 2e',
    bookSubtitle: 'For Science Majors',
    description: 'Covers the scope and sequence of a typical two-semester biology course for science majors. Content is presented through an evolutionary lens with comprehensive coverage of foundational research and core concepts — cell biology, genetics, evolution, biological diversity, plant and animal structure and function, and ecology.',
    targetAudience: 'High school AP Biology / first-year college science majors',
    scope: 'Two-semester comprehensive biology sequence (NGSS-aligned)',
  },
  {
    subject: 'history',
    units: historyCurriculum,
    bookTitle: 'U.S. History',
    bookSubtitle: 'Founding to the Present',
    description: 'Covers the breadth of chronological American history from pre-colonial indigenous societies through the early 21st century. Emphasizes primary source analysis, diverse perspectives, and critical thinking about historical causation.',
    targetAudience: 'High school AP US History / first-year college survey',
    scope: 'Two-semester US History survey (C3 Framework-aligned)',
  },
];

const METADATA_ONLY_COURSES: Omit<CourseMetadata, 'units'>[] = [
  {
    subject: 'microbiology',
    bookTitle: 'Microbiology',
    bookSubtitle: 'An Introduction',
    description: 'Covers the diversity of microorganisms and their role in human health, disease, and the environment. Topics include cell biology of prokaryotes, microbial genetics, immunology, infectious disease, and antimicrobial treatments.',
    targetAudience: 'Pre-nursing, pre-med, and allied health students',
    scope: 'One-semester microbiology for allied health (ASM-aligned)',
  },
  {
    subject: 'anatomy-physiology',
    bookTitle: 'Anatomy and Physiology 2e',
    bookSubtitle: 'Human Body Systems',
    description: 'Explores the structure and function of the human body from the cellular level through major organ systems. Covers skeletal, muscular, nervous, endocrine, cardiovascular, respiratory, urinary, and reproductive systems.',
    targetAudience: 'Pre-nursing, pre-med, and allied health students',
    scope: 'Two-semester human anatomy and physiology sequence',
  },
  {
    subject: 'chemistry',
    bookTitle: 'Chemistry 2e',
    bookSubtitle: 'General Chemistry',
    description: 'Covers the fundamental concepts of general chemistry including atomic structure, chemical bonding, stoichiometry, thermodynamics, kinetics, equilibrium, acids and bases, electrochemistry, and nuclear chemistry.',
    targetAudience: 'First-year college chemistry / AP Chemistry students',
    scope: 'Two-semester general chemistry sequence',
  },
  {
    subject: 'university-physics-vol1',
    bookTitle: 'University Physics Vol 1',
    bookSubtitle: 'Mechanics, Sound, and Waves',
    description: 'Covers classical mechanics including kinematics, Newton\'s laws, work and energy, momentum, rotation, oscillations, waves, and sound. Calculus-based treatment appropriate for engineering and physics majors.',
    targetAudience: 'Engineering and physics college students',
    scope: 'First semester university physics (calculus-based)',
  },
  {
    subject: 'university-physics-vol2',
    bookTitle: 'University Physics Vol 2',
    bookSubtitle: 'Thermodynamics, Electricity, and Magnetism',
    description: 'Covers thermodynamics, electric fields and potentials, circuits, magnetic fields, electromagnetic induction, and Maxwell\'s equations. Calculus-based treatment for engineering and physics majors.',
    targetAudience: 'Engineering and physics college students',
    scope: 'Second semester university physics (calculus-based)',
  },
  {
    subject: 'university-physics-vol3',
    bookTitle: 'University Physics Vol 3',
    bookSubtitle: 'Optics, Relativity, and Quantum Mechanics',
    description: 'Covers optics (geometric and wave), special relativity, quantum mechanics, atomic structure, nuclear physics, and particle physics. Calculus-based treatment for physics and engineering majors.',
    targetAudience: 'Engineering and physics college students',
    scope: 'Third semester university physics (calculus-based)',
  },
  {
    subject: 'college-physics',
    bookTitle: 'College Physics 2e',
    bookSubtitle: 'Algebra-Based Introduction',
    description: 'A comprehensive algebra-based introduction to physics covering mechanics, thermodynamics, electricity and magnetism, optics, and modern physics. Designed for life science and pre-health students.',
    targetAudience: 'Pre-med, life science, and health profession students',
    scope: 'Two-semester algebra-based physics sequence',
  },
  {
    subject: 'astronomy',
    bookTitle: 'Astronomy 2e',
    bookSubtitle: 'The Observable Universe',
    description: 'Covers the science of astronomy including the solar system, stars and stellar evolution, galaxies, cosmology, and the search for life in the universe. Non-calculus treatment for general education students.',
    targetAudience: 'General education college students and curious learners',
    scope: 'One-semester introductory astronomy survey',
  },
  {
    subject: 'prealgebra',
    bookTitle: 'Prealgebra 2e',
    bookSubtitle: 'Foundations of Algebra',
    description: 'Covers whole numbers, fractions, decimals, ratios, percentages, integers, algebraic expressions, equations, geometry basics, and statistics. Prepares students for algebra.',
    targetAudience: 'Middle school and developmental math students',
    scope: 'Pre-algebra foundations course',
  },
  {
    subject: 'elementary-algebra',
    bookTitle: 'Elementary Algebra 2e',
    bookSubtitle: 'Beginning Algebra',
    description: 'Covers linear equations, inequalities, polynomials, factoring, rational expressions, systems of equations, roots and radicals, and quadratic equations.',
    targetAudience: 'Developmental math and early high school students',
    scope: 'Elementary algebra foundations',
  },
  {
    subject: 'college-algebra',
    bookTitle: 'College Algebra 2e',
    bookSubtitle: 'Functions and Equations',
    description: 'Covers polynomial, rational, exponential, and logarithmic functions, systems of equations, matrices, sequences, and conic sections. Prepares students for precalculus or calculus.',
    targetAudience: 'High school and college students preparing for calculus',
    scope: 'One-semester college algebra course',
  },
  {
    subject: 'precalculus',
    bookTitle: 'Precalculus 2e',
    bookSubtitle: 'Functions, Graphs, and Trigonometry',
    description: 'Comprehensive precalculus course covering functions, graphs, polynomial and rational functions, exponential and logarithmic functions, trigonometry, analytic geometry, and discrete mathematics.',
    targetAudience: 'High school and college students preparing for calculus',
    scope: 'One-semester precalculus / trigonometry course',
  },
  {
    subject: 'calculus-vol1',
    bookTitle: 'Calculus Vol 1',
    bookSubtitle: 'Differentiation and Its Applications',
    description: 'Covers limits, continuity, derivatives, differentiation techniques, applications of derivatives (optimization, related rates, curve sketching), and an introduction to integration.',
    targetAudience: 'First-year college students in STEM fields',
    scope: 'First-semester calculus (Calc I)',
  },
  {
    subject: 'calculus-vol2',
    bookTitle: 'Calculus Vol 2',
    bookSubtitle: 'Integration and Infinite Series',
    description: 'Covers integration techniques, applications of integration (area, volume, work), differential equations, sequences, and infinite series including power series and Taylor series.',
    targetAudience: 'First-year college students in STEM fields',
    scope: 'Second-semester calculus (Calc II)',
  },
  {
    subject: 'calculus-vol3',
    bookTitle: 'Calculus Vol 3',
    bookSubtitle: 'Multivariable Calculus',
    description: 'Covers parametric curves, vectors in 3D, partial derivatives, multiple integrals, vector calculus including line integrals and surface integrals, and Green\'s, Stokes\', and Divergence theorems.',
    targetAudience: 'Second-year college students in STEM fields',
    scope: 'Third-semester calculus (Calc III / Multivariable)',
  },
  {
    subject: 'statistics',
    bookTitle: 'Introductory Statistics 2e',
    bookSubtitle: 'Data Analysis and Probability',
    description: 'Covers descriptive statistics, probability, discrete and continuous distributions, sampling, hypothesis testing, confidence intervals, regression, and analysis of variance.',
    targetAudience: 'General college students and social science majors',
    scope: 'One-semester introductory statistics course',
  },
  {
    subject: 'contemporary-math',
    bookTitle: 'Contemporary Mathematics',
    bookSubtitle: 'Mathematics for Liberal Arts',
    description: 'A broad survey of mathematical topics for non-STEM majors including logic, set theory, financial mathematics, geometry, probability, statistics, graph theory, and voting theory.',
    targetAudience: 'Liberal arts and humanities college students',
    scope: 'One-semester math for liberal arts',
  },
  {
    subject: 'world-history-vol1',
    bookTitle: 'World History Vol 1',
    bookSubtitle: 'Prehistory to 1500',
    description: 'Covers world history from the emergence of early human civilizations through the ancient empires of Mesopotamia, Egypt, Greece, Rome, China, India, Africa, and the pre-Columbian Americas, ending with the late medieval period.',
    targetAudience: 'High school and college world history students',
    scope: 'First-semester world history survey',
  },
  {
    subject: 'world-history-vol2',
    bookTitle: 'World History Vol 2',
    bookSubtitle: '1400 to the Present',
    description: 'Covers world history from the Renaissance, Reformation, and early modern period through colonialism, the Industrial Revolution, World Wars, decolonization, and the contemporary global order.',
    targetAudience: 'High school and college world history students',
    scope: 'Second-semester world history survey',
  },
  {
    subject: 'american-government',
    bookTitle: 'American Government 3e',
    bookSubtitle: 'The U.S. Political System',
    description: 'Covers the foundations of American democracy, the Constitution, federalism, civil liberties, the three branches of government, elections, political parties, interest groups, and public policy.',
    targetAudience: 'High school civics and college political science students',
    scope: 'One-semester American government and politics course',
  },
  {
    subject: 'introduction-sociology',
    bookTitle: 'Introduction to Sociology 3e',
    bookSubtitle: 'Society, Culture, and Social Structure',
    description: 'Covers sociological theory, culture, socialization, social groups, deviance, stratification, race and ethnicity, gender, family, education, religion, government, health, and global inequality.',
    targetAudience: 'First-year college social science students',
    scope: 'One-semester introductory sociology course',
  },
  {
    subject: 'psychology',
    bookTitle: 'Psychology 2e',
    bookSubtitle: 'Mind, Brain, and Behavior',
    description: 'Covers history of psychology, biological bases of behavior, sensation and perception, consciousness, learning, memory, cognition, development, personality, social psychology, and psychological disorders.',
    targetAudience: 'High school AP Psychology and introductory college students',
    scope: 'One-semester introductory psychology course',
  },
  {
    subject: 'macroeconomics',
    bookTitle: 'Principles of Macroeconomics 3e',
    bookSubtitle: 'Economy-Wide Concepts',
    description: 'Covers GDP, economic growth, unemployment, inflation, aggregate supply and demand, fiscal policy, the Federal Reserve and monetary policy, international trade, and macroeconomic debates.',
    targetAudience: 'High school AP Macroeconomics and introductory college students',
    scope: 'One-semester introductory macroeconomics course',
  },
  {
    subject: 'microeconomics',
    bookTitle: 'Principles of Microeconomics 3e',
    bookSubtitle: 'Individual and Market Decisions',
    description: 'Covers supply and demand, elasticity, consumer theory, production costs, market structures (perfect competition, monopoly, oligopoly), factor markets, externalities, and public goods.',
    targetAudience: 'High school AP Microeconomics and introductory college students',
    scope: 'One-semester introductory microeconomics course',
  },
  {
    subject: 'principles-management',
    bookTitle: 'Principles of Management',
    bookSubtitle: 'Planning, Organizing, Leading, and Controlling',
    description: 'Covers classical and contemporary management theory, organizational behavior, planning and strategy, organizational design, human resource management, leadership, motivation, and control systems.',
    targetAudience: 'Business and management college students',
    scope: 'One-semester introductory management course',
  },
  {
    subject: 'principles-accounting-vol1',
    bookTitle: 'Principles of Accounting Vol 1',
    bookSubtitle: 'Financial Accounting',
    description: 'Covers the accounting cycle, financial statements, adjusting entries, merchandising operations, inventory, receivables, long-term assets, liabilities, stockholders\' equity, and cash flow statements.',
    targetAudience: 'Business and accounting college students',
    scope: 'One-semester financial accounting course',
  },
  {
    subject: 'principles-finance',
    bookTitle: 'Principles of Finance',
    bookSubtitle: 'Business and Personal Financial Decisions',
    description: 'Covers time value of money, risk and return, financial markets, capital budgeting, cost of capital, capital structure, dividend policy, working capital management, and international finance.',
    targetAudience: 'Business and finance college students',
    scope: 'One-semester introductory corporate finance course',
  },
  {
    subject: 'entrepreneurship',
    bookTitle: 'Entrepreneurship',
    bookSubtitle: 'Building an Entrepreneurial Mindset',
    description: 'Covers entrepreneurial mindset, opportunity identification, business models, market research, financial planning, legal structures, marketing, pitching to investors, and scaling a venture.',
    targetAudience: 'Business and entrepreneurship college students',
    scope: 'One-semester introductory entrepreneurship course',
  },
  {
    subject: 'business-ethics',
    bookTitle: 'Business Ethics',
    bookSubtitle: 'Ethical Decision-Making in Organizations',
    description: 'Covers ethical theory, corporate social responsibility, stakeholder management, leadership ethics, environmental ethics, global and cultural ethics, and ethical issues in specific business functions.',
    targetAudience: 'Business and management college students',
    scope: 'One-semester business ethics course',
  },
  {
    subject: 'philosophy',
    bookTitle: 'Introduction to Philosophy',
    bookSubtitle: 'Questions and Arguments',
    description: 'Surveys the major branches of philosophy including metaphysics, epistemology, philosophy of mind, ethics, political philosophy, and logic. Introduces canonical thinkers from Plato to contemporary philosophers.',
    targetAudience: 'General college students seeking a humanities elective',
    scope: 'One-semester introductory philosophy course',
  },
  {
    subject: 'nutrition',
    bookTitle: 'The Science of Nutrition 2e',
    bookSubtitle: 'Linking Food, Function, and Health',
    description: 'Covers the six classes of nutrients, digestion and absorption, energy metabolism, macronutrients, micronutrients, nutrition across the lifespan, weight management, and diet-related disease.',
    targetAudience: 'Allied health, nursing, and general education students',
    scope: 'One-semester introductory nutrition course',
  },
];

async function seedSyllabi() {
  console.log('Seeding OpenStax syllabi...');

  for (const course of FULL_TOC_COURSES) {
    const existing = await db
      .select({ id: subjectSyllabi.id })
      .from(subjectSyllabi)
      .where(eq(subjectSyllabi.subject, course.subject));

    const totalChapters = course.units.reduce((acc, u) => acc + u.chapters.length, 0);

    if (existing.length > 0) {
      await db.update(subjectSyllabi)
        .set({
          units: course.units,
          bookTitle: course.bookTitle,
          bookSubtitle: course.bookSubtitle,
          description: course.description,
          targetAudience: course.targetAudience,
          scope: course.scope,
        })
        .where(eq(subjectSyllabi.subject, course.subject));
      console.log(`✓ Updated ${course.subject} (${course.bookTitle}): ${course.units.length} units, ${totalChapters} chapters`);
      continue;
    }

    await db.insert(subjectSyllabi).values({
      subject: course.subject,
      units: course.units,
      source: 'openstax',
      bookTitle: course.bookTitle,
      bookSubtitle: course.bookSubtitle,
      description: course.description,
      targetAudience: course.targetAudience,
      scope: course.scope,
    });
    console.log(`✓ Seeded ${course.subject} (${course.bookTitle}): ${course.units.length} units, ${totalChapters} chapters`);
  }

  for (const course of METADATA_ONLY_COURSES) {
    const existing = await db
      .select({ id: subjectSyllabi.id })
      .from(subjectSyllabi)
      .where(eq(subjectSyllabi.subject, course.subject));

    if (existing.length > 0) {
      await db.update(subjectSyllabi)
        .set({
          bookTitle: course.bookTitle,
          bookSubtitle: course.bookSubtitle,
          description: course.description,
          targetAudience: course.targetAudience,
          scope: course.scope,
        })
        .where(eq(subjectSyllabi.subject, course.subject));
      console.log(`✓ Updated metadata: ${course.subject} (${course.bookTitle})`);
      continue;
    }

    await db.insert(subjectSyllabi).values({
      subject: course.subject,
      units: [],
      source: 'openstax',
      bookTitle: course.bookTitle,
      bookSubtitle: course.bookSubtitle,
      description: course.description,
      targetAudience: course.targetAudience,
      scope: course.scope,
    });
    console.log(`✓ Seeded metadata: ${course.subject} (${course.bookTitle})`);
  }

  console.log('\nDone. Summary:');
  const all = await db.select({
    subject: subjectSyllabi.subject,
    bookTitle: subjectSyllabi.bookTitle,
  }).from(subjectSyllabi);
  all.forEach(r => console.log(`  - ${r.subject}: ${r.bookTitle}`));
}

seedSyllabi()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
