import { db } from '../server/db';
import { subjectSyllabi, SyllabusUnit } from '../shared/schema';
import { eq } from 'drizzle-orm';

const biologyCurriculum: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "The Chemistry of Life",
    chapters: [
      { chapterNumber: 1, chapterTitle: "The Study of Life", topic: "The Study of Life" },
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
    unitTitle: "Evolutionary Processes",
    chapters: [
      { chapterNumber: 18, chapterTitle: "Evolution and the Origin of Species", topic: "Evolution and Natural Selection" },
      { chapterNumber: 19, chapterTitle: "The Evolution of Populations", topic: "Population Genetics" },
      { chapterNumber: 20, chapterTitle: "Phylogenies and the History of Life", topic: "Phylogenetics and Classification" },
      { chapterNumber: 21, chapterTitle: "Viruses", topic: "Viruses and Viral Replication" },
      { chapterNumber: 22, chapterTitle: "Prokaryotes: Bacteria and Archaea", topic: "Bacteria and Archaea" },
    ],
  },
  {
    unitNumber: 5,
    unitTitle: "Biological Diversity",
    chapters: [
      { chapterNumber: 23, chapterTitle: "Protists", topic: "Protists" },
      { chapterNumber: 24, chapterTitle: "Fungi", topic: "Fungi" },
      { chapterNumber: 25, chapterTitle: "Seedless Plants", topic: "Seedless Plants" },
      { chapterNumber: 26, chapterTitle: "Seed Plants", topic: "Seed Plants and Flowering Plants" },
      { chapterNumber: 27, chapterTitle: "Introduction to Animal Diversity", topic: "Animal Diversity" },
      { chapterNumber: 28, chapterTitle: "Invertebrates", topic: "Invertebrate Animals" },
      { chapterNumber: 29, chapterTitle: "Vertebrates", topic: "Vertebrate Animals" },
    ],
  },
  {
    unitNumber: 6,
    unitTitle: "Plant Structure and Function",
    chapters: [
      { chapterNumber: 30, chapterTitle: "Plant Form and Physiology", topic: "Plant Form and Physiology" },
      { chapterNumber: 31, chapterTitle: "Soil and Plant Nutrition", topic: "Soil and Plant Nutrition" },
      { chapterNumber: 32, chapterTitle: "Plant Reproduction", topic: "Plant Reproduction" },
    ],
  },
  {
    unitNumber: 7,
    unitTitle: "Animal Structure and Function",
    chapters: [
      { chapterNumber: 33, chapterTitle: "The Animal Body: Basic Form and Function", topic: "Animal Body Plan and Organization" },
      { chapterNumber: 34, chapterTitle: "The Nervous System", topic: "The Nervous System" },
      { chapterNumber: 35, chapterTitle: "The Endocrine System", topic: "The Endocrine System" },
      { chapterNumber: 36, chapterTitle: "The Musculoskeletal System", topic: "The Musculoskeletal System" },
      { chapterNumber: 37, chapterTitle: "The Respiratory System", topic: "The Respiratory System" },
      { chapterNumber: 38, chapterTitle: "The Circulatory System", topic: "The Circulatory System" },
      { chapterNumber: 39, chapterTitle: "Osmotic Regulation and the Excretory System", topic: "The Excretory System" },
      { chapterNumber: 40, chapterTitle: "The Immune System", topic: "The Immune System" },
      { chapterNumber: 41, chapterTitle: "Animal Reproduction and Development", topic: "Animal Reproduction and Development" },
    ],
  },
  {
    unitNumber: 8,
    unitTitle: "Ecology",
    chapters: [
      { chapterNumber: 42, chapterTitle: "Ecology of Ecosystems", topic: "Ecosystem Ecology" },
      { chapterNumber: 43, chapterTitle: "Biomes", topic: "Biomes and Climate" },
      { chapterNumber: 44, chapterTitle: "Conservation Biology and Biodiversity", topic: "Conservation Biology" },
    ],
  },
];

const historyCurriculum: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Meeting of Three Worlds",
    chapters: [
      { chapterNumber: 1, chapterTitle: "The Americas, Europe, and Africa Before 1492", topic: "Pre-Columbian Americas" },
      { chapterNumber: 2, chapterTitle: "Early Exploration and the Columbian Exchange", topic: "The Columbian Exchange" },
      { chapterNumber: 3, chapterTitle: "Creating New Social Orders: Colonial Societies", topic: "Early Colonial Societies" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Colonial Society, 1500–1763",
    chapters: [
      { chapterNumber: 4, chapterTitle: "Rule Britannia! The English Empire", topic: "The English Colonial Empire" },
      { chapterNumber: 5, chapterTitle: "Colonial Society on the Eve of Revolution", topic: "Colonial American Society" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Creating a New Nation, 1754–1800",
    chapters: [
      { chapterNumber: 6, chapterTitle: "America's War for Independence", topic: "The American Revolution" },
      { chapterNumber: 7, chapterTitle: "Creating Republican Governments, 1776–1790", topic: "The Articles of Confederation and Constitutional Convention" },
      { chapterNumber: 8, chapterTitle: "Growing Pains: The New Republic", topic: "The Early American Republic" },
    ],
  },
  {
    unitNumber: 4,
    unitTitle: "A Fluid National Identity, 1800–1848",
    chapters: [
      { chapterNumber: 9, chapterTitle: "Industrial Transformation in the North", topic: "The Industrial Revolution in America" },
      { chapterNumber: 10, chapterTitle: "Jacksonian Democracy", topic: "Jacksonian Democracy" },
      { chapterNumber: 11, chapterTitle: "A Nation on the Move: Westward Expansion", topic: "Westward Expansion and Manifest Destiny" },
    ],
  },
  {
    unitNumber: 5,
    unitTitle: "Tensions Leading to Civil War, 1844–1861",
    chapters: [
      { chapterNumber: 12, chapterTitle: "Cotton is King: The Antebellum South", topic: "The Antebellum South and Slavery" },
      { chapterNumber: 13, chapterTitle: "Antebellum Idealism and Reform Impulses", topic: "Antebellum Reform Movements" },
      { chapterNumber: 14, chapterTitle: "Troubled Times: The Tumultuous 1850s", topic: "The Road to Civil War" },
    ],
  },
  {
    unitNumber: 6,
    unitTitle: "The Civil War and Reconstruction, 1860–1877",
    chapters: [
      { chapterNumber: 15, chapterTitle: "The Civil War", topic: "The American Civil War" },
      { chapterNumber: 16, chapterTitle: "The Era of Reconstruction", topic: "Reconstruction Era" },
    ],
  },
  {
    unitNumber: 7,
    unitTitle: "The New Industrial Age, 1870–1900",
    chapters: [
      { chapterNumber: 17, chapterTitle: "Go West Young Man! Westward Expansion", topic: "The American West and Native Americans" },
      { chapterNumber: 18, chapterTitle: "Industrialization and the Rise of Big Business", topic: "The Gilded Age and Industrialization" },
      { chapterNumber: 19, chapterTitle: "The Growing Pains of Urbanization", topic: "Urbanization in Gilded Age America" },
    ],
  },
  {
    unitNumber: 8,
    unitTitle: "The Progressive Era, 1890–1929",
    chapters: [
      { chapterNumber: 20, chapterTitle: "Politics in the Gilded Age", topic: "Politics in the Gilded Age" },
      { chapterNumber: 21, chapterTitle: "Leading the Way: The Progressive Movement", topic: "The Progressive Movement" },
      { chapterNumber: 22, chapterTitle: "Age of Empire: US Foreign Policy", topic: "American Imperialism" },
    ],
  },
  {
    unitNumber: 9,
    unitTitle: "Crisis and Achievement, 1929–1945",
    chapters: [
      { chapterNumber: 23, chapterTitle: "The Great Depression", topic: "The Great Depression" },
      { chapterNumber: 24, chapterTitle: "Franklin Roosevelt and the New Deal", topic: "The New Deal" },
      { chapterNumber: 25, chapterTitle: "Fighting the Good Fight: World War II", topic: "World War II" },
    ],
  },
  {
    unitNumber: 10,
    unitTitle: "Post-War Prosperity and Cold War Fears, 1945–1960",
    chapters: [
      { chapterNumber: 26, chapterTitle: "Post-War Prosperity and Cold War Fears", topic: "The Cold War" },
      { chapterNumber: 27, chapterTitle: "Fighting the Cold War", topic: "Cold War Foreign Policy" },
      { chapterNumber: 28, chapterTitle: "Prosperity and the Postwar Order", topic: "Postwar American Society" },
    ],
  },
  {
    unitNumber: 11,
    unitTitle: "The Tumultuous Sixties and Seventies, 1960–1980",
    chapters: [
      { chapterNumber: 29, chapterTitle: "The Civil Rights Movement", topic: "The Civil Rights Movement" },
      { chapterNumber: 30, chapterTitle: "Political Storms at Home and Abroad", topic: "The Vietnam War Era" },
      { chapterNumber: 31, chapterTitle: "From the Counterculture to the New Right", topic: "Social Change in the 1960s and 1970s" },
    ],
  },
  {
    unitNumber: 12,
    unitTitle: "Conservatism and Globalization, 1980–2000",
    chapters: [
      { chapterNumber: 32, chapterTitle: "The Reagan Revolution", topic: "The Reagan Era" },
      { chapterNumber: 33, chapterTitle: "New Challenges, New Fears", topic: "America in the 1990s" },
      { chapterNumber: 34, chapterTitle: "America in the 21st Century", topic: "Post-Cold War America" },
    ],
  },
];

interface CourseMetadata {
  subject: string;
  units: typeof biologyCurriculum;
  bookTitle: string;
  bookSubtitle: string;
  description: string;
  targetAudience: string;
  scope: string;
}

const courses: CourseMetadata[] = [
  {
    subject: 'biology',
    units: biologyCurriculum,
    bookTitle: 'Biology 2e',
    bookSubtitle: 'For Science Majors',
    description: 'Covers the scope and sequence of a typical two-semester biology course for science majors. Content is presented through an evolutionary lens with comprehensive coverage of foundational research and core concepts — cell biology, genetics, evolution, biological diversity, plant and animal structure and function, and ecology. Includes scientific inquiry features, career spotlights, and everyday applications.',
    targetAudience: 'High school AP Biology / first-year college science majors',
    scope: 'Two-semester comprehensive biology sequence (NGSS-aligned)',
  },
  {
    subject: 'history',
    units: historyCurriculum,
    bookTitle: 'U.S. History',
    bookSubtitle: 'Founding to the Present',
    description: 'Covers the breadth of chronological American history from pre-colonial indigenous societies through the early 21st century. Emphasizes primary source analysis, diverse perspectives, and critical thinking about historical causation. Organized thematically within chronological units: colonial society, revolution and nation-building, sectional conflict, industrialization, progressivism, the World Wars, the Cold War, the civil rights era, and modern America.',
    targetAudience: 'High school AP US History / first-year college survey',
    scope: 'Two-semester US History survey (C3 Framework-aligned)',
  },
];

async function seedSyllabi() {
  console.log('Seeding OpenStax syllabi...');

  for (const course of courses) {
    const existing = await db
      .select({ id: subjectSyllabi.id })
      .from(subjectSyllabi)
      .where(eq(subjectSyllabi.subject, course.subject));

    if (existing.length > 0) {
      console.log(`✓ ${course.subject} syllabus already exists (id: ${existing[0].id}) — skipping`);
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

    const totalChapters = course.units.reduce((acc, u) => acc + u.chapters.length, 0);
    console.log(`✓ Seeded ${course.subject} (${course.bookTitle}): ${course.units.length} units, ${totalChapters} chapters`);
  }

  console.log('Done.');
}

seedSyllabi()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
