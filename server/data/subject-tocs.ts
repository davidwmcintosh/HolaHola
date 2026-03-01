import type { SyllabusUnit } from '../../shared/schema';

// OpenStax chapter-by-chapter TOC data for all seeded subjects.
// Seeded automatically when a teacher creates an academic class for that subject.
// If no entry exists here, the class is created but isPublicCatalogue stays false
// and the reading library shows "coming soon" for that subject.

const microbiologyTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "The Microbial World",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "An Invisible World",                    topic: "An Invisible World: History of Microbiology" },
      { chapterNumber: 2,  chapterTitle: "How We See the Invisible World",         topic: "Microscopy and Staining Techniques in Microbiology" },
      { chapterNumber: 3,  chapterTitle: "The Cell",                               topic: "Prokaryotic and Eukaryotic Cell Structure" },
      { chapterNumber: 4,  chapterTitle: "Prokaryotic Diversity",                  topic: "Prokaryotic Diversity: Bacteria and Archaea" },
      { chapterNumber: 5,  chapterTitle: "The Eukaryotes of Microbiology",         topic: "Eukaryotic Microorganisms: Fungi, Protozoa, and Algae" },
      { chapterNumber: 6,  chapterTitle: "Acellular Pathogens",                    topic: "Viruses, Viroids, and Prions" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Microbial Physiology and Genetics",
    chapters: [
      { chapterNumber: 7,  chapterTitle: "Microbial Biochemistry",                 topic: "Microbial Biochemistry: Macromolecules and Enzymes" },
      { chapterNumber: 8,  chapterTitle: "Microbial Metabolism",                   topic: "Microbial Metabolism: Energy and Catabolism" },
      { chapterNumber: 9,  chapterTitle: "Microbial Growth",                       topic: "Microbial Growth and Environmental Factors" },
      { chapterNumber: 10, chapterTitle: "Biochemistry of the Genome",             topic: "Microbial Genome Structure and Replication" },
      { chapterNumber: 11, chapterTitle: "Mechanisms of Microbial Genetics",       topic: "Mechanisms of Microbial Genetics and Mutation" },
      { chapterNumber: 12, chapterTitle: "Modern Applications of Microbial Genetics", topic: "Microbial Biotechnology and Genetic Engineering" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Microbial Disease and Control",
    chapters: [
      { chapterNumber: 13, chapterTitle: "Control of Microbial Growth",            topic: "Methods of Controlling Microbial Growth" },
      { chapterNumber: 14, chapterTitle: "Antimicrobial Drugs",                    topic: "Antimicrobial Drugs and Mechanisms of Action" },
      { chapterNumber: 15, chapterTitle: "Microbial Mechanisms of Pathogenicity",  topic: "Microbial Pathogenicity and Virulence Factors" },
      { chapterNumber: 16, chapterTitle: "Disease and Epidemiology",               topic: "Epidemiology and the Spread of Infectious Disease" },
    ],
  },
  {
    unitNumber: 4,
    unitTitle: "Host Defenses and the Immune Response",
    chapters: [
      { chapterNumber: 17, chapterTitle: "Innate Nonspecific Host Defenses",       topic: "Innate Immunity: Physical Barriers and Inflammation" },
      { chapterNumber: 18, chapterTitle: "Adaptive Specific Host Defenses",        topic: "Adaptive Immunity: B Cells, T Cells, and Antibodies" },
      { chapterNumber: 19, chapterTitle: "Diseases of the Immune System",          topic: "Autoimmunity, Hypersensitivity, and Immune Disorders" },
      { chapterNumber: 20, chapterTitle: "Laboratory Analysis of the Immune Response", topic: "Immunological Laboratory Techniques and Diagnostics" },
    ],
  },
  {
    unitNumber: 5,
    unitTitle: "Infectious Disease by Body System",
    chapters: [
      { chapterNumber: 21, chapterTitle: "Skin and Eye Infections",                topic: "Microbial Infections of the Skin and Eyes" },
      { chapterNumber: 22, chapterTitle: "Respiratory System Infections",          topic: "Respiratory Tract Infections and Pneumonia" },
      { chapterNumber: 23, chapterTitle: "Urogenital System Infections",           topic: "Urinary and Reproductive Tract Infections" },
      { chapterNumber: 24, chapterTitle: "Digestive System Infections",            topic: "Gastrointestinal Infections and Food-Borne Illness" },
      { chapterNumber: 25, chapterTitle: "Circulatory and Lymphatic System Infections", topic: "Infections of the Blood and Lymphatic System" },
      { chapterNumber: 26, chapterTitle: "Nervous System Infections",              topic: "Meningitis, Encephalitis, and Nervous System Infections" },
    ],
  },
];

const chemistryTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Matter and Measurement",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Essential Ideas",                                   topic: "Essential Ideas in Chemistry: Matter and Measurement" },
      { chapterNumber: 2,  chapterTitle: "Atoms, Molecules, and Ions",                        topic: "Atoms, Molecules, and Ions" },
      { chapterNumber: 3,  chapterTitle: "Composition of Substances and Solutions",           topic: "Chemical Formulas, Molar Mass, and Solution Concentration" },
      { chapterNumber: 4,  chapterTitle: "Stoichiometry of Chemical Reactions",               topic: "Stoichiometry: Mole Ratios and Limiting Reagents" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Electronic Structure and Bonding",
    chapters: [
      { chapterNumber: 5,  chapterTitle: "Thermochemistry",                                   topic: "Thermochemistry: Enthalpy, Calorimetry, and Hess's Law" },
      { chapterNumber: 6,  chapterTitle: "Electronic Structure and Periodic Properties",      topic: "Electron Configuration and the Periodic Table" },
      { chapterNumber: 7,  chapterTitle: "Chemical Bonding and Molecular Geometry",           topic: "Chemical Bonding: Ionic, Covalent, and VSEPR Theory" },
      { chapterNumber: 8,  chapterTitle: "Advanced Theories of Covalent Bonding",             topic: "Molecular Orbital Theory and Hybridization" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "States of Matter",
    chapters: [
      { chapterNumber: 9,  chapterTitle: "Gases",                                             topic: "Gas Laws: Boyle, Charles, Dalton, and the Ideal Gas Law" },
      { chapterNumber: 10, chapterTitle: "Liquids and Solids",                                topic: "Intermolecular Forces, Liquids, and Solids" },
      { chapterNumber: 11, chapterTitle: "Solutions and Colloids",                            topic: "Solution Chemistry: Solubility, Colligative Properties, and Colloids" },
    ],
  },
  {
    unitNumber: 4,
    unitTitle: "Kinetics and Equilibrium",
    chapters: [
      { chapterNumber: 12, chapterTitle: "Kinetics",                                          topic: "Chemical Kinetics: Reaction Rates and Mechanisms" },
      { chapterNumber: 13, chapterTitle: "Fundamental Equilibrium Concepts",                  topic: "Chemical Equilibrium and Le Chatelier's Principle" },
      { chapterNumber: 14, chapterTitle: "Acid-Base Equilibria",                              topic: "Acid-Base Chemistry: pH, Buffers, and Titrations" },
      { chapterNumber: 15, chapterTitle: "Equilibria of Other Reaction Classes",              topic: "Solubility Equilibria and Complex Ion Formation" },
      { chapterNumber: 16, chapterTitle: "Thermodynamics",                                    topic: "Entropy, Gibbs Free Energy, and Spontaneous Reactions" },
    ],
  },
  {
    unitNumber: 5,
    unitTitle: "Electrochemistry and Nuclear Chemistry",
    chapters: [
      { chapterNumber: 17, chapterTitle: "Electrochemistry",                                  topic: "Electrochemistry: Galvanic Cells, Electrolysis, and Batteries" },
      { chapterNumber: 18, chapterTitle: "Representative Metals, Metalloids, and Nonmetals",  topic: "Properties of Representative Elements and Metalloids" },
      { chapterNumber: 19, chapterTitle: "Transition Metals and Coordination Chemistry",      topic: "Transition Metals and Coordination Compounds" },
      { chapterNumber: 20, chapterTitle: "Organic Chemistry",                                 topic: "Introduction to Organic Chemistry: Hydrocarbons and Functional Groups" },
      { chapterNumber: 21, chapterTitle: "Nuclear Chemistry",                                 topic: "Nuclear Chemistry: Radioactive Decay and Fission" },
    ],
  },
];

const anatomyPhysiologyTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Levels of Organization",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "An Introduction to the Human Body",       topic: "Introduction to Anatomy and Physiology" },
      { chapterNumber: 2,  chapterTitle: "The Chemical Level of Organization",      topic: "Chemistry of the Human Body" },
      { chapterNumber: 3,  chapterTitle: "The Cellular Level of Organization",      topic: "Cell Structure and Function in the Human Body" },
      { chapterNumber: 4,  chapterTitle: "The Tissue Level of Organization",        topic: "Human Body Tissues: Epithelial, Connective, Muscle, and Nervous" },
      { chapterNumber: 5,  chapterTitle: "The Integumentary System",                topic: "Skin, Hair, Nails, and the Integumentary System" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Support and Movement",
    chapters: [
      { chapterNumber: 6,  chapterTitle: "Bone Tissue and the Skeletal System",     topic: "Bone Structure, Growth, and the Skeletal System" },
      { chapterNumber: 7,  chapterTitle: "Axial Skeleton",                          topic: "The Axial Skeleton: Skull, Vertebral Column, and Rib Cage" },
      { chapterNumber: 8,  chapterTitle: "The Appendicular Skeleton",               topic: "The Appendicular Skeleton: Limbs and Girdles" },
      { chapterNumber: 9,  chapterTitle: "Joints",                                  topic: "Types of Joints and Synovial Joint Movement" },
      { chapterNumber: 10, chapterTitle: "Muscle Tissue",                           topic: "Muscle Tissue: Structure, Contraction, and Fiber Types" },
      { chapterNumber: 11, chapterTitle: "The Muscular System",                     topic: "Major Muscle Groups and the Muscular System" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Regulation, Integration, and Control",
    chapters: [
      { chapterNumber: 12, chapterTitle: "The Nervous System and Nervous Tissue",   topic: "Nervous System Organization and Neuron Structure" },
      { chapterNumber: 13, chapterTitle: "Anatomy of the Nervous System",           topic: "Brain, Spinal Cord, and Peripheral Nervous System" },
      { chapterNumber: 14, chapterTitle: "The Somatic Nervous System",              topic: "Somatic Nervous System: Sensory and Motor Pathways" },
      { chapterNumber: 15, chapterTitle: "The Autonomic Nervous System",            topic: "Autonomic Nervous System: Sympathetic and Parasympathetic" },
      { chapterNumber: 16, chapterTitle: "The Neurological Exam",                   topic: "Neurological Assessment and Reflexes" },
      { chapterNumber: 17, chapterTitle: "The Endocrine System",                    topic: "Hormones, Glands, and Endocrine Regulation" },
    ],
  },
  {
    unitNumber: 4,
    unitTitle: "Fluids and Transport",
    chapters: [
      { chapterNumber: 18, chapterTitle: "The Cardiovascular System: Blood",        topic: "Blood Composition, Blood Types, and Hemostasis" },
      { chapterNumber: 19, chapterTitle: "The Cardiovascular System: The Heart",    topic: "Heart Anatomy, Cardiac Cycle, and ECG" },
      { chapterNumber: 20, chapterTitle: "The Cardiovascular System: Blood Vessels", topic: "Blood Vessels, Blood Pressure, and Circulation" },
      { chapterNumber: 21, chapterTitle: "The Lymphatic and Immune System",         topic: "Lymphatic System and Immune Defenses" },
    ],
  },
  {
    unitNumber: 5,
    unitTitle: "Energy, Maintenance, and Environmental Exchange",
    chapters: [
      { chapterNumber: 22, chapterTitle: "The Respiratory System",                  topic: "Respiratory Anatomy and Gas Exchange" },
      { chapterNumber: 23, chapterTitle: "The Digestive System",                    topic: "Digestive Organs, Enzymes, and Nutrient Absorption" },
      { chapterNumber: 24, chapterTitle: "Metabolism and Nutrition",                topic: "Cellular Metabolism and Nutritional Requirements" },
      { chapterNumber: 25, chapterTitle: "The Urinary System",                      topic: "Kidney Structure and Urine Formation" },
      { chapterNumber: 26, chapterTitle: "Fluid, Electrolyte, and Acid-Base Balance", topic: "Body Fluid Balance, Electrolytes, and pH Regulation" },
    ],
  },
  {
    unitNumber: 6,
    unitTitle: "Human Development and the Continuity of Life",
    chapters: [
      { chapterNumber: 27, chapterTitle: "The Reproductive System",                 topic: "Male and Female Reproductive Anatomy and Hormones" },
      { chapterNumber: 28, chapterTitle: "Development and Inheritance",             topic: "Embryonic Development, Pregnancy, and Genetics" },
    ],
  },
];

const physicsVol1TOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Mechanics",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Units and Measurement",        topic: "Physical Quantities, Units, and Measurement" },
      { chapterNumber: 2,  chapterTitle: "Vectors",                      topic: "Vectors: Components, Addition, and Dot Product" },
      { chapterNumber: 3,  chapterTitle: "Motion Along a Straight Line", topic: "Kinematics in One Dimension: Displacement, Velocity, Acceleration" },
      { chapterNumber: 4,  chapterTitle: "Motion in Two and Three Dimensions", topic: "Projectile Motion and Circular Motion" },
      { chapterNumber: 5,  chapterTitle: "Newton's Laws of Motion",      topic: "Newton's Laws of Motion and Free Body Diagrams" },
      { chapterNumber: 6,  chapterTitle: "Applications of Newton's Laws", topic: "Friction, Drag, and Centripetal Force" },
      { chapterNumber: 7,  chapterTitle: "Work and Kinetic Energy",      topic: "Work, Kinetic Energy, and the Work-Energy Theorem" },
      { chapterNumber: 8,  chapterTitle: "Potential Energy and Conservation of Energy", topic: "Potential Energy, Conservative Forces, and Energy Conservation" },
      { chapterNumber: 9,  chapterTitle: "Linear Momentum and Collisions", topic: "Momentum, Impulse, and Collisions" },
      { chapterNumber: 10, chapterTitle: "Fixed-Axis Rotation",          topic: "Rotational Kinematics and Moment of Inertia" },
      { chapterNumber: 11, chapterTitle: "Angular Momentum",             topic: "Angular Momentum, Torque, and Rotational Dynamics" },
      { chapterNumber: 12, chapterTitle: "Static Equilibrium and Elasticity", topic: "Static Equilibrium, Stress, and Strain" },
      { chapterNumber: 13, chapterTitle: "Gravitation",                  topic: "Newton's Law of Gravitation and Orbital Mechanics" },
      { chapterNumber: 14, chapterTitle: "Fluid Mechanics",              topic: "Fluid Statics, Buoyancy, and Fluid Dynamics" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Waves and Acoustics",
    chapters: [
      { chapterNumber: 15, chapterTitle: "Oscillations",                 topic: "Simple Harmonic Motion and Pendulums" },
      { chapterNumber: 16, chapterTitle: "Waves",                        topic: "Mechanical Waves: Transverse, Longitudinal, and Standing Waves" },
      { chapterNumber: 17, chapterTitle: "Sound",                        topic: "Sound Waves, Intensity, and the Doppler Effect" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Thermodynamics",
    chapters: [
      { chapterNumber: 18, chapterTitle: "Temperature and Heat",         topic: "Temperature Scales, Thermal Expansion, and Heat Transfer" },
      { chapterNumber: 19, chapterTitle: "The Kinetic Theory of Gases",  topic: "Ideal Gas Law and Kinetic Molecular Theory" },
      { chapterNumber: 20, chapterTitle: "The First Law of Thermodynamics", topic: "Internal Energy, Work, and the First Law of Thermodynamics" },
      { chapterNumber: 21, chapterTitle: "The Second Law of Thermodynamics", topic: "Entropy, Heat Engines, and the Second Law" },
    ],
  },
];

const physicsVol2TOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Electricity and Magnetism",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Electric Charges and Fields",     topic: "Electric Charge, Coulomb's Law, and Electric Fields" },
      { chapterNumber: 2,  chapterTitle: "Gauss's Law",                      topic: "Gauss's Law and Electric Flux" },
      { chapterNumber: 3,  chapterTitle: "Electric Potential",               topic: "Electric Potential, Capacitance, and Energy Storage" },
      { chapterNumber: 4,  chapterTitle: "Capacitance",                      topic: "Capacitors, Dielectrics, and Stored Energy" },
      { chapterNumber: 5,  chapterTitle: "Current and Resistance",           topic: "Electric Current, Resistance, and Ohm's Law" },
      { chapterNumber: 6,  chapterTitle: "Direct-Current Circuits",          topic: "DC Circuits: Kirchhoff's Laws and RC Circuits" },
      { chapterNumber: 7,  chapterTitle: "Magnetic Forces and Fields",       topic: "Magnetic Force on Charges and Current-Carrying Wires" },
      { chapterNumber: 8,  chapterTitle: "Sources of Magnetic Fields",       topic: "Biot-Savart Law, Ampere's Law, and Solenoids" },
      { chapterNumber: 9,  chapterTitle: "Faraday's Law",                    topic: "Electromagnetic Induction and Lenz's Law" },
      { chapterNumber: 10, chapterTitle: "Inductance",                       topic: "Inductors, LR Circuits, and Energy in Magnetic Fields" },
      { chapterNumber: 11, chapterTitle: "Alternating-Current Circuits",     topic: "AC Circuits: RLC, Resonance, and Transformers" },
      { chapterNumber: 12, chapterTitle: "Electromagnetic Waves",            topic: "Maxwell's Equations and the Electromagnetic Spectrum" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Optics",
    chapters: [
      { chapterNumber: 13, chapterTitle: "The Nature of Light",             topic: "Wave-Particle Duality and the Speed of Light" },
      { chapterNumber: 14, chapterTitle: "Geometric Optics and Image Formation", topic: "Reflection, Refraction, Mirrors, and Lenses" },
      { chapterNumber: 15, chapterTitle: "Interference",                    topic: "Light Interference and Young's Double-Slit Experiment" },
      { chapterNumber: 16, chapterTitle: "Diffraction",                     topic: "Diffraction, Single-Slit, and Diffraction Gratings" },
    ],
  },
];

const physicsVol3TOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Modern Physics",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Relativity",                     topic: "Special Relativity: Time Dilation, Length Contraction, and E=mc²" },
      { chapterNumber: 2,  chapterTitle: "Photons and Matter Waves",       topic: "Photons, Photoelectric Effect, and de Broglie Wavelength" },
      { chapterNumber: 3,  chapterTitle: "The Hydrogen Atom",              topic: "Bohr Model, Atomic Spectra, and Quantum Numbers" },
      { chapterNumber: 4,  chapterTitle: "The Quantum Mechanical Model of the Atom", topic: "Wave Functions, Orbitals, and the Schrödinger Equation" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Nuclear and Particle Physics",
    chapters: [
      { chapterNumber: 5,  chapterTitle: "Atomic Structure",               topic: "Atomic Spectra, Lasers, and the Pauli Exclusion Principle" },
      { chapterNumber: 6,  chapterTitle: "Condensed Matter Physics",       topic: "Crystal Structure, Conductors, Semiconductors, and Superconductors" },
      { chapterNumber: 7,  chapterTitle: "Nuclear Physics",                topic: "Nuclear Structure, Radioactive Decay, and Nuclear Energy" },
      { chapterNumber: 8,  chapterTitle: "Particle Physics and Cosmology", topic: "Fundamental Particles, the Standard Model, and the Big Bang" },
    ],
  },
];

const astronomyTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Observing the Sky",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Science and the Universe",       topic: "The Scale of the Universe and the Scientific Method" },
      { chapterNumber: 2,  chapterTitle: "Observing the Sky",              topic: "Celestial Sphere, Seasons, and Moon Phases" },
      { chapterNumber: 3,  chapterTitle: "Orbits and Gravity",             topic: "Kepler's Laws, Newton's Gravity, and Orbital Mechanics" },
      { chapterNumber: 4,  chapterTitle: "Earth, Moon, and Sky",           topic: "Earth's Interior, Plate Tectonics, and Lunar Geology" },
      { chapterNumber: 5,  chapterTitle: "Radiation and Spectra",          topic: "Light, Electromagnetic Spectrum, and Spectroscopy" },
      { chapterNumber: 6,  chapterTitle: "Astronomical Instruments",       topic: "Telescopes, Detectors, and Observatories" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Our Solar System",
    chapters: [
      { chapterNumber: 7,  chapterTitle: "Other Worlds: An Introduction to the Solar System", topic: "Formation of the Solar System" },
      { chapterNumber: 8,  chapterTitle: "Earth as a Planet",              topic: "Earth's Atmosphere, Magnetic Field, and Climate" },
      { chapterNumber: 9,  chapterTitle: "Cratered Worlds",                topic: "The Moon and Mercury: Impact Cratering" },
      { chapterNumber: 10, chapterTitle: "Earthlike Planets",              topic: "Venus and Mars: Atmospheres and Surface Features" },
      { chapterNumber: 11, chapterTitle: "The Giant Planets",              topic: "Jupiter, Saturn, Uranus, and Neptune" },
      { chapterNumber: 12, chapterTitle: "Rings, Moons, and Pluto",        topic: "Planetary Moons, Ring Systems, and Dwarf Planets" },
      { chapterNumber: 13, chapterTitle: "Comets and Asteroids",           topic: "Small Solar System Bodies: Comets, Asteroids, and Meteoroids" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Stars",
    chapters: [
      { chapterNumber: 14, chapterTitle: "The Sun: A Garden-Variety Star", topic: "Solar Structure, Energy Production, and Solar Activity" },
      { chapterNumber: 15, chapterTitle: "The Stars: A Celestial Census",  topic: "Stellar Properties: Luminosity, Temperature, and the HR Diagram" },
      { chapterNumber: 16, chapterTitle: "The Interstellar Medium",        topic: "Nebulae, Star-Forming Regions, and the ISM" },
      { chapterNumber: 17, chapterTitle: "The Birth of Stars",             topic: "Protostar Formation and Pre-Main-Sequence Evolution" },
      { chapterNumber: 18, chapterTitle: "Star Stuff",                     topic: "Stellar Nucleosynthesis and the Origin of Elements" },
      { chapterNumber: 19, chapterTitle: "The Death of Stars",             topic: "Supernovae, White Dwarfs, Neutron Stars, and Black Holes" },
    ],
  },
  {
    unitNumber: 4,
    unitTitle: "Galaxies and Cosmology",
    chapters: [
      { chapterNumber: 20, chapterTitle: "The Milky Way Galaxy",           topic: "Structure, Center, and Rotation of the Milky Way" },
      { chapterNumber: 21, chapterTitle: "Galaxies",                       topic: "Galaxy Types, Distances, and Active Galactic Nuclei" },
      { chapterNumber: 22, chapterTitle: "The Big Bang",                   topic: "Cosmology: Hubble's Law, Dark Matter, and the Big Bang" },
      { chapterNumber: 23, chapterTitle: "Life in the Universe",           topic: "Astrobiology: The Search for Extraterrestrial Life" },
    ],
  },
];

const nutritionTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Foundations of Nutrition",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Nutrition and You",              topic: "Nutrition Science: Nutrients, Diet, and Health" },
      { chapterNumber: 2,  chapterTitle: "Tools for Healthy Eating",       topic: "Dietary Guidelines, MyPlate, and Food Labels" },
      { chapterNumber: 3,  chapterTitle: "Digestion and Absorption",       topic: "Digestive System and Nutrient Absorption" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Macronutrients",
    chapters: [
      { chapterNumber: 4,  chapterTitle: "Carbohydrates",                  topic: "Carbohydrates: Sugars, Starches, Fiber, and Glycemic Index" },
      { chapterNumber: 5,  chapterTitle: "Lipids",                         topic: "Dietary Fats: Saturated, Unsaturated, and Cholesterol" },
      { chapterNumber: 6,  chapterTitle: "Proteins and Amino Acids",       topic: "Proteins: Amino Acids, Protein Quality, and Protein Needs" },
      { chapterNumber: 7,  chapterTitle: "Energy Balance and Body Composition", topic: "Metabolism, Energy Balance, and Weight Management" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Micronutrients",
    chapters: [
      { chapterNumber: 8,  chapterTitle: "Vitamins",                       topic: "Fat-Soluble and Water-Soluble Vitamins" },
      { chapterNumber: 9,  chapterTitle: "Water and Minerals",             topic: "Electrolytes, Major Minerals, and Trace Minerals" },
    ],
  },
  {
    unitNumber: 4,
    unitTitle: "Nutrition Across the Lifespan",
    chapters: [
      { chapterNumber: 10, chapterTitle: "Life Cycle Nutrition",           topic: "Nutritional Needs in Pregnancy, Infancy, and Childhood" },
      { chapterNumber: 11, chapterTitle: "Nutrition and Physical Activity", topic: "Sports Nutrition and Fueling for Exercise" },
      { chapterNumber: 12, chapterTitle: "Food Safety and Technology",     topic: "Foodborne Illness, Food Processing, and Biotechnology" },
    ],
  },
];

const calculusVol1TOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Limits and Continuity",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Functions and Graphs",          topic: "Functions, Graphs, and Mathematical Models" },
      { chapterNumber: 2,  chapterTitle: "Limits",                        topic: "Introduction to Limits and the Limit Laws" },
      { chapterNumber: 3,  chapterTitle: "Derivatives",                   topic: "The Derivative: Definition, Rules, and Differentiation" },
      { chapterNumber: 4,  chapterTitle: "Applications of Derivatives",   topic: "Curve Sketching, Optimization, and Related Rates" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Integration",
    chapters: [
      { chapterNumber: 5,  chapterTitle: "Integration",                   topic: "Antiderivatives, Riemann Sums, and the Fundamental Theorem" },
      { chapterNumber: 6,  chapterTitle: "Applications of Integration",   topic: "Area, Volume, and Work Using Integrals" },
    ],
  },
];

const calculusVol2TOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Integration Techniques and Applications",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Integration by Parts",          topic: "Integration Techniques: Parts, Trig, and Partial Fractions" },
      { chapterNumber: 2,  chapterTitle: "Techniques of Integration",     topic: "Trigonometric Substitution and Improper Integrals" },
      { chapterNumber: 3,  chapterTitle: "Introduction to Differential Equations", topic: "Separable and Linear Differential Equations" },
      { chapterNumber: 4,  chapterTitle: "Sequence and Series",           topic: "Infinite Sequences and Series: Convergence Tests" },
      { chapterNumber: 5,  chapterTitle: "Power Series",                  topic: "Taylor and Maclaurin Series" },
    ],
  },
];

const calculusVol3TOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Multivariable Calculus",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Parametric Equations and Polar Coordinates", topic: "Parametric Curves, Polar Coordinates, and Conic Sections" },
      { chapterNumber: 2,  chapterTitle: "Vectors in Space",              topic: "Vectors, Dot Product, Cross Product, and 3D Geometry" },
      { chapterNumber: 3,  chapterTitle: "Vector-Valued Functions",       topic: "Space Curves, Arc Length, and Curvature" },
      { chapterNumber: 4,  chapterTitle: "Differentiation of Functions of Several Variables", topic: "Partial Derivatives, Gradient, and the Chain Rule" },
      { chapterNumber: 5,  chapterTitle: "Multiple Integration",          topic: "Double and Triple Integrals and Change of Variables" },
      { chapterNumber: 6,  chapterTitle: "Vector Calculus",               topic: "Vector Fields, Line Integrals, and Green's Theorem" },
    ],
  },
];

const statisticsTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Exploring Data",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Sampling and Data",             topic: "Statistical Studies: Sampling Methods and Data Types" },
      { chapterNumber: 2,  chapterTitle: "Descriptive Statistics",        topic: "Measures of Center, Spread, and Distribution Shapes" },
      { chapterNumber: 3,  chapterTitle: "Probability Topics",            topic: "Probability Rules, Conditional Probability, and Bayes" },
      { chapterNumber: 4,  chapterTitle: "Discrete Random Variables",     topic: "Binomial and Poisson Distributions" },
      { chapterNumber: 5,  chapterTitle: "Continuous Random Variables",   topic: "Uniform and Exponential Distributions" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Inference",
    chapters: [
      { chapterNumber: 6,  chapterTitle: "The Normal Distribution",       topic: "The Normal Curve, Z-Scores, and the Central Limit Theorem" },
      { chapterNumber: 7,  chapterTitle: "The Central Limit Theorem",     topic: "Sampling Distributions and Standard Error" },
      { chapterNumber: 8,  chapterTitle: "Confidence Intervals",          topic: "Confidence Intervals for Means and Proportions" },
      { chapterNumber: 9,  chapterTitle: "Hypothesis Testing with One Sample", topic: "Hypothesis Testing: Z-Tests and T-Tests" },
      { chapterNumber: 10, chapterTitle: "Hypothesis Testing with Two Samples", topic: "Two-Sample Tests and Paired Data" },
      { chapterNumber: 11, chapterTitle: "The Chi-Square Distribution",   topic: "Chi-Square Tests: Goodness of Fit and Independence" },
      { chapterNumber: 12, chapterTitle: "Linear Regression and Correlation", topic: "Correlation and Linear Regression Analysis" },
      { chapterNumber: 13, chapterTitle: "F Distribution and One-Way ANOVA", topic: "ANOVA: Comparing Multiple Group Means" },
    ],
  },
];

const psychologyTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Foundations of Psychology",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Introduction to Psychology",       topic: "What is Psychology? History, Schools, and Methods" },
      { chapterNumber: 2,  chapterTitle: "Psychological Research",           topic: "Research Methods in Psychology: Experiments and Ethics" },
      { chapterNumber: 3,  chapterTitle: "Biopsychology",                    topic: "The Brain, Nervous System, and Genetics in Psychology" },
      { chapterNumber: 4,  chapterTitle: "States of Consciousness",          topic: "Consciousness, Sleep, Dreams, and Altered States" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Sensation and Cognition",
    chapters: [
      { chapterNumber: 5,  chapterTitle: "Sensation and Perception",         topic: "How We Sense and Perceive the World" },
      { chapterNumber: 6,  chapterTitle: "Learning",                         topic: "Classical Conditioning, Operant Conditioning, and Observational Learning" },
      { chapterNumber: 7,  chapterTitle: "Thinking and Intelligence",        topic: "Problem Solving, Decision Making, and Intelligence Testing" },
      { chapterNumber: 8,  chapterTitle: "Memory",                           topic: "Memory Encoding, Storage, Retrieval, and Forgetting" },
      { chapterNumber: 9,  chapterTitle: "Lifespan Development",             topic: "Developmental Psychology: Cognitive, Social, and Physical Development" },
      { chapterNumber: 10, chapterTitle: "Emotion and Motivation",           topic: "Theories of Emotion, Motivation, and Hunger" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Personality and Social Psychology",
    chapters: [
      { chapterNumber: 11, chapterTitle: "Personality",                      topic: "Personality Theories: Psychoanalytic, Trait, Humanistic, Social-Cognitive" },
      { chapterNumber: 12, chapterTitle: "Social Psychology",                topic: "Attitudes, Conformity, Obedience, and Group Behavior" },
      { chapterNumber: 13, chapterTitle: "Industrial-Organizational Psychology", topic: "Work, Motivation, and Leadership in Organizations" },
      { chapterNumber: 14, chapterTitle: "Stress, Lifestyle, and Health",    topic: "Stress, Coping, and Health Psychology" },
    ],
  },
  {
    unitNumber: 4,
    unitTitle: "Psychological Disorders and Treatment",
    chapters: [
      { chapterNumber: 15, chapterTitle: "Psychological Disorders",          topic: "Anxiety, Mood, Psychotic, and Personality Disorders" },
      { chapterNumber: 16, chapterTitle: "Treatment of Psychological Disorders", topic: "Psychotherapy, Drug Treatments, and Humanistic Therapies" },
    ],
  },
];

const worldHistoryVol1TOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "The Ancient World",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Understanding the Past",           topic: "Historiography and Historical Thinking Skills" },
      { chapterNumber: 2,  chapterTitle: "Early Humans and Migration",       topic: "Paleolithic Humans, Migration, and the Agricultural Revolution" },
      { chapterNumber: 3,  chapterTitle: "Early Civilizations",              topic: "Mesopotamia, Egypt, and Early River Valley Civilizations" },
      { chapterNumber: 4,  chapterTitle: "The Near East",                    topic: "Babylon, Assyria, Persia, and the Ancient Near East" },
      { chapterNumber: 5,  chapterTitle: "South and Southeast Asia",         topic: "Indus Valley Civilization and Vedic India" },
      { chapterNumber: 6,  chapterTitle: "East Asia",                        topic: "Ancient China: Dynasties, Confucianism, and the Silk Road" },
      { chapterNumber: 7,  chapterTitle: "Africa",                           topic: "Ancient Africa: Egypt, Nubia, and Sub-Saharan Kingdoms" },
      { chapterNumber: 8,  chapterTitle: "Ancient Greece",                   topic: "Greek City-States, Democracy, and Classical Culture" },
      { chapterNumber: 9,  chapterTitle: "The Roman Empire",                 topic: "Rome: Republic, Empire, and the Fall of Rome" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "The Middle Ages",
    chapters: [
      { chapterNumber: 10, chapterTitle: "The Rise of Islam",                topic: "The Origins of Islam and the Islamic Caliphates" },
      { chapterNumber: 11, chapterTitle: "The Byzantine Empire",             topic: "Byzantium, Orthodox Christianity, and Eastern Europe" },
      { chapterNumber: 12, chapterTitle: "Medieval Europe",                  topic: "Feudalism, the Catholic Church, and the Crusades" },
      { chapterNumber: 13, chapterTitle: "East Asia in the Middle Ages",     topic: "Tang and Song China, Japan, and Korea" },
      { chapterNumber: 14, chapterTitle: "The Mongol Empire",                topic: "Genghis Khan and the Mongol Empire" },
      { chapterNumber: 15, chapterTitle: "Africa in the Middle Ages",        topic: "Mali, Songhai, Great Zimbabwe, and East African Trade" },
      { chapterNumber: 16, chapterTitle: "The Americas before Contact",      topic: "Maya, Aztec, and Inca Civilizations" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "The Early Modern Period",
    chapters: [
      { chapterNumber: 17, chapterTitle: "The Renaissance and Reformation",  topic: "Renaissance Humanism and the Protestant Reformation" },
      { chapterNumber: 18, chapterTitle: "Age of Exploration",               topic: "European Exploration and the Columbian Exchange" },
      { chapterNumber: 19, chapterTitle: "The Atlantic World",               topic: "The Slave Trade and Colonialism in the Americas" },
      { chapterNumber: 20, chapterTitle: "Asian Empires",                    topic: "Ottoman, Mughal, and Ming/Qing Empires" },
    ],
  },
];

const worldHistoryVol2TOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Revolution and Industry",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "The Scientific Revolution and Enlightenment", topic: "Scientific Revolution and Enlightenment Thought" },
      { chapterNumber: 2,  chapterTitle: "Political Revolutions",            topic: "American, French, and Haitian Revolutions" },
      { chapterNumber: 3,  chapterTitle: "The Industrial Revolution",        topic: "Industrialization: Causes, Consequences, and Social Change" },
      { chapterNumber: 4,  chapterTitle: "Imperialism and Colonialism",      topic: "European Imperialism in Africa and Asia" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "The Modern World",
    chapters: [
      { chapterNumber: 5,  chapterTitle: "World War I",                      topic: "Causes, Course, and Consequences of World War I" },
      { chapterNumber: 6,  chapterTitle: "The Interwar Period",              topic: "Rise of Fascism, the Great Depression, and Totalitarianism" },
      { chapterNumber: 7,  chapterTitle: "World War II",                     topic: "World War II: Causes, Events, and the Holocaust" },
      { chapterNumber: 8,  chapterTitle: "The Cold War",                     topic: "Cold War: US-Soviet Rivalry and Proxy Conflicts" },
      { chapterNumber: 9,  chapterTitle: "Decolonization and Independence",  topic: "Decolonization in Africa, Asia, and the Middle East" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "The Contemporary World",
    chapters: [
      { chapterNumber: 10, chapterTitle: "Globalization",                    topic: "Globalization: Economic Integration and Cultural Exchange" },
      { chapterNumber: 11, chapterTitle: "Technology and Society",           topic: "The Digital Revolution and Its Impact on Society" },
      { chapterNumber: 12, chapterTitle: "Contemporary Issues",              topic: "Climate Change, Migration, and 21st Century Challenges" },
    ],
  },
];

const americanGovernmentTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Foundations of American Democracy",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "American Government and Civic Engagement", topic: "Origins of American Democracy and Civic Participation" },
      { chapterNumber: 2,  chapterTitle: "The Constitution and Its Origins",  topic: "The Constitutional Convention and the U.S. Constitution" },
      { chapterNumber: 3,  chapterTitle: "The Federal System",                topic: "Federalism: Division of Power between State and Federal Government" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Institutions of Government",
    chapters: [
      { chapterNumber: 4,  chapterTitle: "Civil Liberties",                   topic: "Bill of Rights and Civil Liberties" },
      { chapterNumber: 5,  chapterTitle: "Civil Rights",                      topic: "Civil Rights Movement and Equal Protection" },
      { chapterNumber: 6,  chapterTitle: "The Legislature",                   topic: "Congress: Structure, Powers, and Lawmaking" },
      { chapterNumber: 7,  chapterTitle: "The Presidency",                    topic: "The Executive Branch: Powers of the President" },
      { chapterNumber: 8,  chapterTitle: "The Judicial Branch",               topic: "The Supreme Court and Judicial Review" },
      { chapterNumber: 9,  chapterTitle: "The Bureaucracy",                   topic: "The Federal Bureaucracy and Regulatory Agencies" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Political Participation",
    chapters: [
      { chapterNumber: 10, chapterTitle: "Political Parties",                 topic: "American Political Parties and the Party System" },
      { chapterNumber: 11, chapterTitle: "Campaigns and Elections",           topic: "Electoral Process, Voting, and Campaign Finance" },
      { chapterNumber: 12, chapterTitle: "Interest Groups and Lobbying",      topic: "Interest Groups, PACs, and Political Influence" },
      { chapterNumber: 13, chapterTitle: "The Media",                         topic: "Media, Public Opinion, and Political Communication" },
      { chapterNumber: 14, chapterTitle: "Domestic Policy",                   topic: "Domestic Policy: Healthcare, Education, and Social Policy" },
      { chapterNumber: 15, chapterTitle: "Foreign Policy",                    topic: "U.S. Foreign Policy and National Security" },
      { chapterNumber: 16, chapterTitle: "State and Local Government",        topic: "State Governments, Local Politics, and Intergovernmental Relations" },
    ],
  },
];

const sociologyTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Sociology and Society",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "An Introduction to Sociology",    topic: "What is Sociology? Perspectives, Methods, and History" },
      { chapterNumber: 2,  chapterTitle: "Sociological Research",           topic: "Research Methods in Sociology: Surveys, Ethnography, and Experiments" },
      { chapterNumber: 3,  chapterTitle: "Culture",                         topic: "Culture, Subculture, and Cultural Values" },
      { chapterNumber: 4,  chapterTitle: "Society and Social Interaction",  topic: "Social Structure, Status, Roles, and Groups" },
      { chapterNumber: 5,  chapterTitle: "Socialization",                   topic: "Socialization: Agents, Stages, and Resocialization" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Social Structure and Inequality",
    chapters: [
      { chapterNumber: 6,  chapterTitle: "Groups and Organizations",        topic: "Social Groups, Formal Organizations, and Bureaucracy" },
      { chapterNumber: 7,  chapterTitle: "Deviance, Crime, and Social Control", topic: "Deviance, Crime, and Social Control" },
      { chapterNumber: 8,  chapterTitle: "Social Stratification",           topic: "Social Class, Inequality, and Social Mobility" },
      { chapterNumber: 9,  chapterTitle: "Global Inequality",               topic: "Global Poverty and International Stratification" },
      { chapterNumber: 10, chapterTitle: "Race and Ethnicity",              topic: "Race, Ethnicity, Prejudice, and Discrimination" },
      { chapterNumber: 11, chapterTitle: "Gender, Sex, and Sexuality",      topic: "Gender Roles, Feminism, and Sexual Orientation" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Social Institutions",
    chapters: [
      { chapterNumber: 12, chapterTitle: "Aging and the Elderly",           topic: "Aging, Ageism, and Elder Care" },
      { chapterNumber: 13, chapterTitle: "Marriage and Family",             topic: "Family Structures, Marriage, and Divorce" },
      { chapterNumber: 14, chapterTitle: "Religion",                        topic: "Sociology of Religion: Beliefs, Churches, and Secularism" },
      { chapterNumber: 15, chapterTitle: "Education",                       topic: "Education Systems, Inequality in Schools, and Higher Education" },
      { chapterNumber: 16, chapterTitle: "Government and Politics",         topic: "Political Sociology: Power, Authority, and Democracy" },
      { chapterNumber: 17, chapterTitle: "Work and the Economy",            topic: "Labor Markets, Capitalism, and the Changing Economy" },
      { chapterNumber: 18, chapterTitle: "Health and Medicine",             topic: "Sociology of Health, Healthcare, and Illness" },
      { chapterNumber: 19, chapterTitle: "Population, Urbanization, and the Environment", topic: "Demography, Urbanization, and Environmental Sociology" },
      { chapterNumber: 20, chapterTitle: "Social Movements and Change",     topic: "Collective Behavior, Social Movements, and Social Change" },
    ],
  },
];

const macroeconomicsTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Foundations",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Welcome to Economics",           topic: "Scarcity, Opportunity Cost, and the Economic Way of Thinking" },
      { chapterNumber: 2,  chapterTitle: "Choice in a World of Scarcity",  topic: "Production Possibilities Frontier and Trade-offs" },
      { chapterNumber: 3,  chapterTitle: "Demand and Supply",              topic: "Supply and Demand: Markets and Price Determination" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Macroeconomic Concepts",
    chapters: [
      { chapterNumber: 4,  chapterTitle: "National Income and GDP",        topic: "Measuring GDP, Economic Growth, and the Business Cycle" },
      { chapterNumber: 5,  chapterTitle: "Unemployment",                   topic: "Types of Unemployment and the Natural Rate" },
      { chapterNumber: 6,  chapterTitle: "Inflation",                      topic: "Inflation, CPI, and the Effects of Price Changes" },
      { chapterNumber: 7,  chapterTitle: "The International Trade and Capital Flows", topic: "Balance of Payments, Exchange Rates, and International Trade" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Macroeconomic Policy",
    chapters: [
      { chapterNumber: 8,  chapterTitle: "Aggregate Supply and Aggregate Demand", topic: "AD-AS Model and Macroeconomic Equilibrium" },
      { chapterNumber: 9,  chapterTitle: "The Keynesian Perspective",      topic: "Keynesian Economics and Fiscal Policy Multipliers" },
      { chapterNumber: 10, chapterTitle: "Monetary Policy",                topic: "The Federal Reserve, Money Supply, and Interest Rates" },
      { chapterNumber: 11, chapterTitle: "Fiscal Policy",                  topic: "Government Spending, Taxes, and the National Debt" },
      { chapterNumber: 12, chapterTitle: "Economic Growth",                topic: "Sources of Long-Run Economic Growth and Productivity" },
    ],
  },
];

const microeconomicsTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Supply, Demand, and Markets",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Welcome to Economics",           topic: "Introduction to Microeconomics and Scarcity" },
      { chapterNumber: 2,  chapterTitle: "Choice in a World of Scarcity",  topic: "Trade-offs, Opportunity Cost, and the PPF" },
      { chapterNumber: 3,  chapterTitle: "Demand and Supply",              topic: "Markets, Supply and Demand, and Price Equilibrium" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Consumer and Producer Theory",
    chapters: [
      { chapterNumber: 4,  chapterTitle: "Elasticity",                     topic: "Price Elasticity of Demand and Supply" },
      { chapterNumber: 5,  chapterTitle: "Consumer Choices",               topic: "Utility Maximization and Consumer Decision Making" },
      { chapterNumber: 6,  chapterTitle: "Production and Costs",           topic: "Production Functions, Costs, and Economies of Scale" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Market Structures",
    chapters: [
      { chapterNumber: 7,  chapterTitle: "Perfect Competition",            topic: "Perfectly Competitive Markets and Profit Maximization" },
      { chapterNumber: 8,  chapterTitle: "Monopoly",                       topic: "Monopoly: Barriers to Entry and Deadweight Loss" },
      { chapterNumber: 9,  chapterTitle: "Monopolistic Competition and Oligopoly", topic: "Monopolistic Competition, Oligopoly, and Game Theory" },
      { chapterNumber: 10, chapterTitle: "Wages and Discrimination",       topic: "Labor Markets, Wage Determination, and Income Inequality" },
      { chapterNumber: 11, chapterTitle: "Poverty and Economic Inequality", topic: "Poverty, Income Distribution, and Government Redistribution" },
      { chapterNumber: 12, chapterTitle: "Environmental Protection",       topic: "Externalities, Public Goods, and Environmental Policy" },
    ],
  },
];

const philosophyTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Introduction to Philosophy",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "What Is Philosophy?",            topic: "Philosophy: Definition, History, and Methods of Inquiry" },
      { chapterNumber: 2,  chapterTitle: "Critical Thinking and Logic",    topic: "Arguments, Logical Fallacies, and Critical Thinking" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Core Branches of Philosophy",
    chapters: [
      { chapterNumber: 3,  chapterTitle: "Epistemology",                   topic: "Epistemology: Knowledge, Justified Belief, and Skepticism" },
      { chapterNumber: 4,  chapterTitle: "Metaphysics",                    topic: "Metaphysics: Reality, Identity, Time, and Free Will" },
      { chapterNumber: 5,  chapterTitle: "Philosophy of Mind",             topic: "Consciousness, the Mind-Body Problem, and Personal Identity" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Ethics and Applied Philosophy",
    chapters: [
      { chapterNumber: 6,  chapterTitle: "Ethics",                         topic: "Ethical Theories: Consequentialism, Deontology, and Virtue Ethics" },
      { chapterNumber: 7,  chapterTitle: "Social and Political Philosophy", topic: "Justice, Rights, Democracy, and Political Obligation" },
      { chapterNumber: 8,  chapterTitle: "Applied Ethics",                  topic: "Bioethics, Environmental Ethics, and Business Ethics" },
    ],
  },
];

const managementTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Foundations of Management",
    chapters: [
      { chapterNumber: 1, chapterTitle: "The Nature of Management",        topic: "Management Roles, Functions, and Schools of Thought" },
      { chapterNumber: 2, chapterTitle: "History of Management",           topic: "Evolution of Management Theory: Scientific to Modern" },
      { chapterNumber: 3, chapterTitle: "Ethics and Social Responsibility", topic: "Business Ethics and Corporate Social Responsibility" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Planning and Strategy",
    chapters: [
      { chapterNumber: 4, chapterTitle: "Planning and Decision Making",    topic: "Strategic Planning and Managerial Decision Making" },
      { chapterNumber: 5, chapterTitle: "Entrepreneurship",                topic: "Entrepreneurship, Innovation, and New Venture Management" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Organizing and Leading",
    chapters: [
      { chapterNumber: 6, chapterTitle: "Organizational Structure",        topic: "Organizational Design: Structures and Coordination" },
      { chapterNumber: 7, chapterTitle: "Human Resource Management",       topic: "Recruiting, Training, Performance, and Compensation" },
      { chapterNumber: 8, chapterTitle: "Diversity in Organizations",      topic: "Workplace Diversity, Equity, and Inclusion" },
      { chapterNumber: 9, chapterTitle: "Leadership",                      topic: "Leadership Styles, Theories, and Transformational Leadership" },
      { chapterNumber: 10, chapterTitle: "Motivation",                     topic: "Motivating Employees: Maslow, Herzberg, and Expectancy Theory" },
      { chapterNumber: 11, chapterTitle: "Team Management",                topic: "Building and Managing High-Performance Teams" },
      { chapterNumber: 12, chapterTitle: "Communication",                  topic: "Organizational Communication and Conflict Resolution" },
    ],
  },
  {
    unitNumber: 4,
    unitTitle: "Controlling and Innovation",
    chapters: [
      { chapterNumber: 13, chapterTitle: "Control and Operations",         topic: "Management Control Systems and Operations Management" },
      { chapterNumber: 14, chapterTitle: "Innovation and Change",          topic: "Managing Organizational Change and Innovation" },
    ],
  },
];

const accountingTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Foundation of Accounting",
    chapters: [
      { chapterNumber: 1, chapterTitle: "Role of Accounting in Society",   topic: "Purpose of Accounting and the Accounting Profession" },
      { chapterNumber: 2, chapterTitle: "Introduction to Financial Statements", topic: "Balance Sheet, Income Statement, and Cash Flow Statement" },
      { chapterNumber: 3, chapterTitle: "The Accounting Cycle",            topic: "The Accounting Cycle: Journals, Ledgers, and Trial Balance" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Recording and Reporting",
    chapters: [
      { chapterNumber: 4, chapterTitle: "Completing the Accounting Cycle", topic: "Adjusting Entries, Closing Entries, and Financial Statements" },
      { chapterNumber: 5, chapterTitle: "Merchandising Operations",        topic: "Inventory, Cost of Goods Sold, and Merchandising Accounting" },
      { chapterNumber: 6, chapterTitle: "Receivables and Revenue",         topic: "Accounts Receivable, Notes Receivable, and Revenue Recognition" },
      { chapterNumber: 7, chapterTitle: "Long-Term Assets",                topic: "Property, Plant, Equipment, and Depreciation Methods" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Liabilities and Equity",
    chapters: [
      { chapterNumber: 8, chapterTitle: "Current Liabilities",             topic: "Short-Term Debt, Payroll, and Current Liabilities" },
      { chapterNumber: 9, chapterTitle: "Long-Term Liabilities",           topic: "Bonds Payable, Mortgages, and Long-Term Debt" },
      { chapterNumber: 10, chapterTitle: "Stockholders' Equity",           topic: "Corporate Stock, Dividends, and Retained Earnings" },
    ],
  },
];

const financeTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Foundations of Finance",
    chapters: [
      { chapterNumber: 1, chapterTitle: "Introduction to Finance",         topic: "Role of Finance, Financial Markets, and the Time Value of Money" },
      { chapterNumber: 2, chapterTitle: "Corporate Structure and Stakeholders", topic: "Business Structures, Stakeholders, and Corporate Governance" },
      { chapterNumber: 3, chapterTitle: "Economic Foundations",            topic: "Supply, Demand, Interest Rates, and the Financial System" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Valuation and Risk",
    chapters: [
      { chapterNumber: 4, chapterTitle: "Time Value of Money",             topic: "Present Value, Future Value, Annuities, and Amortization" },
      { chapterNumber: 5, chapterTitle: "Bonds and Bond Valuation",        topic: "Bond Pricing, Yield to Maturity, and Interest Rate Risk" },
      { chapterNumber: 6, chapterTitle: "Stock Valuation",                 topic: "Stock Pricing: Dividend Discount and P/E Models" },
      { chapterNumber: 7, chapterTitle: "Risk and Return",                 topic: "Portfolio Theory, Beta, and the Capital Asset Pricing Model" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Corporate Finance",
    chapters: [
      { chapterNumber: 8, chapterTitle: "Capital Budgeting",               topic: "NPV, IRR, and Capital Investment Decisions" },
      { chapterNumber: 9, chapterTitle: "Cost of Capital",                 topic: "WACC and Optimal Capital Structure" },
      { chapterNumber: 10, chapterTitle: "Dividend Policy",                topic: "Dividend Policy, Payout Ratios, and Stock Buybacks" },
    ],
  },
];

const entrepreneurshipTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "The Entrepreneurial Mindset",
    chapters: [
      { chapterNumber: 1, chapterTitle: "The Entrepreneurial Perspective",  topic: "What is Entrepreneurship? Traits and Types of Entrepreneurs" },
      { chapterNumber: 2, chapterTitle: "Building Your Entrepreneurial Team", topic: "Team Building, Co-founders, and Early Hires" },
      { chapterNumber: 3, chapterTitle: "The Entrepreneurial Journey",      topic: "The Entrepreneurial Process: Ideation to Launch" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Identifying and Evaluating Opportunities",
    chapters: [
      { chapterNumber: 4, chapterTitle: "Creativity and Ideation",          topic: "Design Thinking, Ideation, and Problem Solving" },
      { chapterNumber: 5, chapterTitle: "Identifying and Researching Opportunities", topic: "Market Research and Opportunity Evaluation" },
      { chapterNumber: 6, chapterTitle: "Problem Solving and Need Recognition", topic: "Customer Discovery and Problem-Solution Fit" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Business Planning and Launch",
    chapters: [
      { chapterNumber: 7, chapterTitle: "Telling Your Entrepreneurial Story", topic: "Business Planning, Pitching, and the Business Model Canvas" },
      { chapterNumber: 8, chapterTitle: "Entrepreneurial Marketing",        topic: "Marketing for Startups: Customer Acquisition and Branding" },
      { chapterNumber: 9, chapterTitle: "Entrepreneurial Finance and Accounting", topic: "Startup Funding, Financial Projections, and Cash Flow" },
      { chapterNumber: 10, chapterTitle: "Launching the Venture",           topic: "Launching a Business: Legal Structure and Operations" },
    ],
  },
];

const businessEthicsTOC: SyllabusUnit[] = [
  {
    unitNumber: 1,
    unitTitle: "Foundations of Business Ethics",
    chapters: [
      { chapterNumber: 1, chapterTitle: "Why Ethics Matter",               topic: "The Importance of Ethics in Business" },
      { chapterNumber: 2, chapterTitle: "Ethical Decision Making",         topic: "Ethical Frameworks: Consequentialism, Deontology, and Virtue" },
      { chapterNumber: 3, chapterTitle: "Corporate Social Responsibility", topic: "CSR, Stakeholder Theory, and Sustainability" },
    ],
  },
  {
    unitNumber: 2,
    unitTitle: "Stakeholders and Workplace Ethics",
    chapters: [
      { chapterNumber: 4, chapterTitle: "Individuals, Organizations, and Society", topic: "Individual Ethics and Organizational Culture" },
      { chapterNumber: 5, chapterTitle: "Work and the Workplace",          topic: "Workplace Rights, Privacy, and Employee Relations" },
      { chapterNumber: 6, chapterTitle: "Diversity, Equity, and Inclusion", topic: "Ethics of Diversity: Fairness, Bias, and Inclusion" },
    ],
  },
  {
    unitNumber: 3,
    unitTitle: "Applied Business Ethics",
    chapters: [
      { chapterNumber: 7, chapterTitle: "Ethics of Marketing and Advertising", topic: "Truth in Advertising and Ethical Marketing Practices" },
      { chapterNumber: 8, chapterTitle: "Ethics in Finance and Accounting", topic: "Financial Ethics: Fraud, Insider Trading, and Transparency" },
      { chapterNumber: 9, chapterTitle: "Environmental Ethics",             topic: "Environmental Responsibility and Sustainable Business" },
      { chapterNumber: 10, chapterTitle: "Ethical Leadership",             topic: "Leadership Ethics, Whistleblowing, and Governance" },
    ],
  },
];

// Minimal stubs for the algebra/pre-calc subjects (commonly covered in high school)
const prealgebraTOC: SyllabusUnit[] = [
  {
    unitNumber: 1, unitTitle: "Whole Numbers and Integers",
    chapters: [
      { chapterNumber: 1, chapterTitle: "Whole Numbers",            topic: "Place Value, Rounding, and Operations with Whole Numbers" },
      { chapterNumber: 2, chapterTitle: "The Language of Algebra",  topic: "Variables, Expressions, and Equations" },
      { chapterNumber: 3, chapterTitle: "Integers",                 topic: "Integers: Operations, Absolute Value, and Number Lines" },
      { chapterNumber: 4, chapterTitle: "Fractions",                topic: "Fractions: Simplifying, Multiplying, Dividing" },
      { chapterNumber: 5, chapterTitle: "Decimals",                 topic: "Decimals and Percents" },
    ],
  },
  {
    unitNumber: 2, unitTitle: "Ratios, Proportions, and Geometry",
    chapters: [
      { chapterNumber: 6, chapterTitle: "Ratios and Rates",         topic: "Ratios, Rates, and Proportions" },
      { chapterNumber: 7, chapterTitle: "The Properties of Real Numbers", topic: "Properties of Real Numbers and the Distributive Property" },
      { chapterNumber: 8, chapterTitle: "Solving Linear Equations and Inequalities", topic: "Solving One- and Two-Step Linear Equations" },
      { chapterNumber: 9, chapterTitle: "Graphs",                   topic: "Coordinate Plane, Slope, and Linear Graphs" },
      { chapterNumber: 10, chapterTitle: "Geometry",                topic: "Perimeter, Area, and Volume" },
    ],
  },
];

const elementaryAlgebraTOC: SyllabusUnit[] = [
  {
    unitNumber: 1, unitTitle: "Foundations of Algebra",
    chapters: [
      { chapterNumber: 1, chapterTitle: "Foundations",              topic: "Number Sets, Order of Operations, and Properties" },
      { chapterNumber: 2, chapterTitle: "Solving Linear Equations and Inequalities", topic: "Linear Equations and Inequalities in One Variable" },
      { chapterNumber: 3, chapterTitle: "Graphs and Functions",     topic: "Graphing Linear Equations and Introduction to Functions" },
    ],
  },
  {
    unitNumber: 2, unitTitle: "Polynomials and Factoring",
    chapters: [
      { chapterNumber: 4, chapterTitle: "Systems of Linear Equations", topic: "Systems of Equations: Substitution and Elimination" },
      { chapterNumber: 5, chapterTitle: "Polynomials and Polynomial Functions", topic: "Polynomials: Addition, Subtraction, Multiplication" },
      { chapterNumber: 6, chapterTitle: "Factoring",                  topic: "Factoring Polynomials: GCF, Trinomials, and Difference of Squares" },
      { chapterNumber: 7, chapterTitle: "Rational Expressions and Equations", topic: "Rational Expressions: Simplifying and Solving" },
      { chapterNumber: 8, chapterTitle: "Roots and Radicals",         topic: "Square Roots, Cube Roots, and the Pythagorean Theorem" },
      { chapterNumber: 9, chapterTitle: "Quadratic Equations",        topic: "Solving Quadratic Equations: Factoring and the Quadratic Formula" },
    ],
  },
];

const collegeAlgebraTOC: SyllabusUnit[] = [
  {
    unitNumber: 1, unitTitle: "Functions and Their Graphs",
    chapters: [
      { chapterNumber: 1, chapterTitle: "Prerequisites",              topic: "Real Numbers, Polynomials, and Factoring Review" },
      { chapterNumber: 2, chapterTitle: "Equations and Inequalities", topic: "Equations: Linear, Quadratic, Radical, and Absolute Value" },
      { chapterNumber: 3, chapterTitle: "Functions",                  topic: "Functions: Notation, Domain, Range, and Transformations" },
      { chapterNumber: 4, chapterTitle: "Linear Functions",           topic: "Linear Functions, Slope, and Linear Models" },
      { chapterNumber: 5, chapterTitle: "Polynomial and Rational Functions", topic: "Polynomial Division, Roots, and Rational Functions" },
    ],
  },
  {
    unitNumber: 2, unitTitle: "Exponentials, Logs, and Systems",
    chapters: [
      { chapterNumber: 6, chapterTitle: "Exponential and Logarithmic Functions", topic: "Exponential Growth, Logarithms, and Logarithmic Equations" },
      { chapterNumber: 7, chapterTitle: "Systems of Equations and Inequalities", topic: "Systems of Equations: Matrices and Gaussian Elimination" },
      { chapterNumber: 8, chapterTitle: "Analytic Geometry",          topic: "Conic Sections: Parabolas, Ellipses, and Hyperbolas" },
      { chapterNumber: 9, chapterTitle: "Sequences and Series",       topic: "Arithmetic and Geometric Sequences and Series" },
    ],
  },
];

const precalculusTOC: SyllabusUnit[] = [
  {
    unitNumber: 1, unitTitle: "Functions and Polynomials",
    chapters: [
      { chapterNumber: 1, chapterTitle: "Functions",                  topic: "Functions, Inverses, and Transformations" },
      { chapterNumber: 2, chapterTitle: "Linear Functions",           topic: "Linear and Piecewise Functions" },
      { chapterNumber: 3, chapterTitle: "Polynomial and Rational Functions", topic: "Polynomials, Rational Functions, and their Graphs" },
      { chapterNumber: 4, chapterTitle: "Exponential and Logarithmic Functions", topic: "Exponential and Logarithmic Functions and Applications" },
    ],
  },
  {
    unitNumber: 2, unitTitle: "Trigonometry",
    chapters: [
      { chapterNumber: 5, chapterTitle: "Trigonometric Functions",     topic: "Angles, Unit Circle, and Trigonometric Functions" },
      { chapterNumber: 6, chapterTitle: "Periodic Functions",          topic: "Graphs of Sine, Cosine, and Tangent" },
      { chapterNumber: 7, chapterTitle: "Trigonometric Identities and Equations", topic: "Trigonometric Identities and Solving Trig Equations" },
      { chapterNumber: 8, chapterTitle: "Further Applications of Trigonometry", topic: "Law of Sines, Law of Cosines, and Vectors" },
    ],
  },
  {
    unitNumber: 3, unitTitle: "Advanced Topics",
    chapters: [
      { chapterNumber: 9, chapterTitle: "Systems of Equations and Matrices", topic: "Systems of Equations and Matrix Operations" },
      { chapterNumber: 10, chapterTitle: "Analytic Geometry",         topic: "Conic Sections in Standard and General Form" },
      { chapterNumber: 11, chapterTitle: "Sequences, Probability and Counting Theory", topic: "Sequences, Series, and Binomial Theorem" },
    ],
  },
];

const contemporaryMathTOC: SyllabusUnit[] = [
  {
    unitNumber: 1, unitTitle: "Algebra and Problem Solving",
    chapters: [
      { chapterNumber: 1, chapterTitle: "Sets",                       topic: "Set Theory: Unions, Intersections, and Venn Diagrams" },
      { chapterNumber: 2, chapterTitle: "Logic",                      topic: "Mathematical Logic: Statements, Connectives, and Truth Tables" },
      { chapterNumber: 3, chapterTitle: "Real Number Systems",        topic: "Number Systems and Order of Operations" },
      { chapterNumber: 4, chapterTitle: "Number Representation",      topic: "Binary, Octal, and Hexadecimal Number Systems" },
    ],
  },
  {
    unitNumber: 2, unitTitle: "Finance and Statistics",
    chapters: [
      { chapterNumber: 5, chapterTitle: "Algebra Applications",       topic: "Linear Equations, Proportions, and Percent Applications" },
      { chapterNumber: 6, chapterTitle: "Money Management",           topic: "Personal Finance: Budgeting, Interest, and Loans" },
      { chapterNumber: 7, chapterTitle: "Probability",                topic: "Basic Probability and Expected Value" },
      { chapterNumber: 8, chapterTitle: "Statistics",                 topic: "Descriptive Statistics, Graphs, and Normal Distribution" },
    ],
  },
  {
    unitNumber: 3, unitTitle: "Geometry and Voting",
    chapters: [
      { chapterNumber: 9,  chapterTitle: "Metric Measurement",        topic: "The Metric System and Unit Conversions" },
      { chapterNumber: 10, chapterTitle: "Geometry",                  topic: "2D and 3D Geometry: Perimeter, Area, and Volume" },
      { chapterNumber: 11, chapterTitle: "Voting and Apportionment",  topic: "Voting Methods and Mathematical Fairness" },
      { chapterNumber: 12, chapterTitle: "Graph Theory",              topic: "Graph Theory: Euler Paths, Hamilton Circuits, and Networks" },
    ],
  },
];

const collegePhysicsTOC: SyllabusUnit[] = [
  {
    unitNumber: 1, unitTitle: "Mechanics",
    chapters: [
      { chapterNumber: 1,  chapterTitle: "Introduction: The Nature of Science and Physics", topic: "The Nature of Physics and Units of Measurement" },
      { chapterNumber: 2,  chapterTitle: "Kinematics",               topic: "Kinematics: Velocity, Acceleration, and Free Fall" },
      { chapterNumber: 3,  chapterTitle: "Two-Dimensional Kinematics", topic: "Projectile Motion and Circular Motion" },
      { chapterNumber: 4,  chapterTitle: "Dynamics: Force and Newton's Laws", topic: "Newton's Laws of Motion and Free Body Diagrams" },
      { chapterNumber: 5,  chapterTitle: "Friction, Drag, and Elasticity", topic: "Friction, Air Resistance, and Hooke's Law" },
      { chapterNumber: 6,  chapterTitle: "Work, Energy, and Energy Resources", topic: "Work, Kinetic Energy, Potential Energy, and Conservation" },
      { chapterNumber: 7,  chapterTitle: "Linear Momentum and Collisions", topic: "Momentum, Impulse, and Collisions" },
      { chapterNumber: 8,  chapterTitle: "Rotational Motion",        topic: "Torque, Angular Momentum, and Rotational Equilibrium" },
      { chapterNumber: 9,  chapterTitle: "Statics and Torque",       topic: "Static Equilibrium and Center of Mass" },
      { chapterNumber: 10, chapterTitle: "Fluid Statics",            topic: "Pressure, Buoyancy, and Archimedes' Principle" },
      { chapterNumber: 11, chapterTitle: "Fluid Dynamics",           topic: "Continuity Equation and Bernoulli's Principle" },
    ],
  },
  {
    unitNumber: 2, unitTitle: "Waves, Electricity, and Optics",
    chapters: [
      { chapterNumber: 12, chapterTitle: "Oscillatory Motion and Waves", topic: "Simple Harmonic Motion and Wave Properties" },
      { chapterNumber: 13, chapterTitle: "Sound",                    topic: "Sound Waves, Resonance, and the Doppler Effect" },
      { chapterNumber: 14, chapterTitle: "Electric Charge and Electric Field", topic: "Coulomb's Law and Electric Fields" },
      { chapterNumber: 15, chapterTitle: "Electric Potential and Field", topic: "Voltage, Capacitance, and Electric Potential Energy" },
      { chapterNumber: 16, chapterTitle: "Electric Current and Resistance", topic: "Ohm's Law, Resistance, and DC Circuits" },
      { chapterNumber: 17, chapterTitle: "Electromagnetic Induction and Faraday's Law", topic: "Electromagnetic Induction and AC Circuits" },
      { chapterNumber: 18, chapterTitle: "Geometric Optics",         topic: "Reflection, Refraction, Mirrors, and Lenses" },
      { chapterNumber: 19, chapterTitle: "Wave Optics",              topic: "Interference, Diffraction, and Polarization" },
    ],
  },
];

// Master map — key matches the `subject` field in subject_syllabi
export const SUBJECT_TOCS: Record<string, SyllabusUnit[]> = {
  microbiology:              microbiologyTOC,
  "anatomy-physiology":      anatomyPhysiologyTOC,
  chemistry:                 chemistryTOC,
  "university-physics-vol1": physicsVol1TOC,
  "university-physics-vol2": physicsVol2TOC,
  "university-physics-vol3": physicsVol3TOC,
  "college-physics":         collegePhysicsTOC,
  astronomy:                 astronomyTOC,
  nutrition:                 nutritionTOC,
  prealgebra:                prealgebraTOC,
  "elementary-algebra":      elementaryAlgebraTOC,
  "college-algebra":         collegeAlgebraTOC,
  precalculus:               precalculusTOC,
  "calculus-vol1":           calculusVol1TOC,
  "calculus-vol2":           calculusVol2TOC,
  "calculus-vol3":           calculusVol3TOC,
  statistics:                statisticsTOC,
  "contemporary-math":       contemporaryMathTOC,
  "world-history-vol1":      worldHistoryVol1TOC,
  "world-history-vol2":      worldHistoryVol2TOC,
  "american-government":     americanGovernmentTOC,
  "introduction-sociology":  sociologyTOC,
  psychology:                psychologyTOC,
  macroeconomics:            macroeconomicsTOC,
  microeconomics:            microeconomicsTOC,
  philosophy:                philosophyTOC,
  "principles-management":       managementTOC,
  "principles-accounting-vol1":  accountingTOC,
  "principles-finance":          financeTOC,
  entrepreneurship:              entrepreneurshipTOC,
  "business-ethics":             businessEthicsTOC,
  // biology and history are already seeded with full TOC via seed-syllabi.ts
};

export function getTOCForSubject(subject: string): SyllabusUnit[] | null {
  return SUBJECT_TOCS[subject] ?? null;
}
