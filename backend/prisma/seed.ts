import { PrismaClient, Role, ProductType, OrderStatus, EntitlementScope } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Ensure backend/uploads directory exists
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Generate a valid, compliant single-page PDF with Helvetica font and styled text
 */
function createPdfBuffer(title: string, subtitle: string, bullets: string[]): Buffer {
  const cleanTitle = title.replace(/[()\\\r\n]/g, ' ');
  const cleanSub = subtitle.replace(/[()\\\r\n]/g, ' ');
  const cleanBullets = bullets.map((b) => b.replace(/[()\\\r\n]/g, ' '));

  const streamLines = [
    'BT',
    '/F1 18 Tf',
    '50 780 Td',
    `(${cleanTitle}) Tj`,
    '/F1 12 Tf',
    '0 -28 Td',
    `(${cleanSub}) Tj`,
    '0 -30 Td',
    '/F1 13 Tf',
    '(Key Chapter Concepts & Syllabus Breakdown:) Tj',
    '/F1 10 Tf',
    ...cleanBullets.flatMap((b, idx) => [
      '0 -22 Td',
      `(${idx + 1}. ${b}) Tj`,
    ]),
    '0 -45 Td',
    '/F1 9 Tf',
    '(EdTech Interactive Learning Platform - Verified Academic Materials) Tj',
    'ET',
  ];
  const stream = streamLines.join('\n');
  const streamLen = Buffer.byteLength(stream);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  offsets.push(pdf.length);
  pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

  offsets.push(pdf.length);
  pdf += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';

  offsets.push(pdf.length);
  pdf += '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n';

  offsets.push(pdf.length);
  pdf += '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

  offsets.push(pdf.length);
  pdf += `5 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`;

  const startXref = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  for (const off of offsets) {
    pdf += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf-8');
}

/**
 * Curriculum Data Tree
 */
interface ChapterData {
  name: string;
  isFree?: boolean;
  bullets: string[];
}

interface SubjectData {
  name: string;
  chapters: ChapterData[];
}

interface ClassData {
  name: string;
  monthlyPrice: number; // in paise
  annualPrice: number;  // in paise
  subjects: SubjectData[];
}

interface BoardData {
  name: string;
  classes: ClassData[];
}

const BOARDS_DATA: BoardData[] = [
  {
    name: 'CBSE',
    classes: [
      {
        name: 'Class 10',
        monthlyPrice: 49900,
        annualPrice: 299900,
        subjects: [
          {
            name: 'Science',
            chapters: [
              {
                name: 'Chemical Reactions and Equations',
                isFree: true,
                bullets: [
                  'Balancing Chemical Equations with conservation of mass',
                  'Types of Reactions: Combination, Decomposition, Displacement',
                  'Oxidation, Reduction, Redox reactions & Redox agents',
                  'Corrosion and Rancidity prevention techniques',
                ],
              },
              {
                name: 'Acids, Bases and Salts',
                bullets: [
                  'pH scale and importance of pH in everyday life',
                  'Reaction of acids and bases with metals and carbonates',
                  'Preparation and uses of Bleaching Powder and Baking Soda',
                  'Plaster of Paris and Water of Crystallization',
                ],
              },
              {
                name: 'Metals and Non-metals',
                bullets: [
                  'Physical and chemical properties of metals and non-metals',
                  'Reactivity series of metals and ionic compound properties',
                  'Extraction of metals: Roasting and Calcination',
                  'Refining of copper and prevention of corrosion',
                ],
              },
              {
                name: 'Carbon and its Compounds',
                bullets: [
                  'Covalent bonding in carbon compounds and allotropes',
                  'Versatile nature of carbon: Catenation & Tetravalency',
                  'Homologous series and IUPAC functional groups',
                  'Chemical reactions: Combustion, Oxidation, Addition, Esterification',
                ],
              },
              {
                name: 'Life Processes',
                bullets: [
                  'Autotrophic and Heterotrophic nutrition in humans & plants',
                  'Aerobic vs Anaerobic respiration and ATP cycle',
                  'Human circulatory system and blood pressure regulation',
                  'Excretion in human beings: Structure of Nephron',
                ],
              },
              {
                name: 'Control and Coordination',
                bullets: [
                  'Human nervous system: Structure of a Neuron',
                  'Reflex arc and reflex actions in animals',
                  'Human Brain: Forebrain, Midbrain, and Hindbrain functions',
                  'Plant hormones: Auxins, Gibberellins, Cytokinins, Abscisic acid',
                ],
              },
              {
                name: 'Electricity',
                bullets: [
                  "Ohm's Law: Resistance, Resistivity and Factors affecting R",
                  'Series and Parallel combinations of Resistors',
                  "Joule's Law of Heating and electric fuse applications",
                  'Electric Power formulas: P = VI = I^2 R = V^2 / R',
                ],
              },
              {
                name: 'Magnetic Effects of Electric Current',
                bullets: [
                  'Magnetic field lines and Right Hand Thumb Rule',
                  "Fleming's Left Hand Rule and electric motor principle",
                  'Electromagnetic Induction and Fleming Right Hand Rule',
                  'Domestic electric circuits, Earthing, and short-circuit hazards',
                ],
              },
            ],
          },
          {
            name: 'Mathematics',
            chapters: [
              {
                name: 'Real Numbers',
                isFree: true,
                bullets: [
                  'Fundamental Theorem of Arithmetic and prime factor tree',
                  'Proof of irrationality for sqrt(2), sqrt(3), and sqrt(5)',
                  'Revisiting rational numbers and terminating decimal expansions',
                  'HCF and LCM relation: HCF(a, b) * LCM(a, b) = a * b',
                ],
              },
              {
                name: 'Polynomials',
                bullets: [
                  'Geometrical meaning of zeroes of a polynomial',
                  'Relationship between zeroes and coefficients of quadratic polynomials',
                  'Alpha + Beta = -b/a and Alpha * Beta = c/a',
                  'Forming quadratic polynomial with given sum and product',
                ],
              },
              {
                name: 'Pair of Linear Equations in Two Variables',
                bullets: [
                  'Graphical method of solution and consistency conditions',
                  'Algebraic solution by Substitution Method',
                  'Algebraic solution by Elimination Method',
                  'Real-world word problems on speed, time, and work',
                ],
              },
              {
                name: 'Quadratic Equations',
                bullets: [
                  'Standard form: ax^2 + bx + c = 0 (a != 0)',
                  'Solution of quadratic equations by Factorization',
                  'Quadratic formula: x = (-b +- sqrt(D)) / 2a',
                  'Nature of roots based on Discriminant (D = b^2 - 4ac)',
                ],
              },
              {
                name: 'Arithmetic Progressions',
                bullets: [
                  'nth term formula: a_n = a + (n - 1)d',
                  'Sum of first n terms: S_n = n/2 [2a + (n - 1)d]',
                  'Arithmetic mean and practical daily life application problems',
                  'Derivation of finite AP sums and series analysis',
                ],
              },
              {
                name: 'Coordinate Geometry',
                bullets: [
                  'Distance formula: d = sqrt((x2 - x1)^2 + (y2 - y1)^2)',
                  'Section formula for internal division of line segments',
                  'Midpoint formula and centroid of a triangle',
                  'Collinearity verification of three points on cartesian plane',
                ],
              },
              {
                name: 'Introduction to Trigonometry',
                bullets: [
                  'Trigonometric ratios of acute angles (sin, cos, tan, cot, sec, cosec)',
                  'Trigonometric values for 0, 30, 45, 60, and 90 degrees',
                  'Trigonometric identities: sin^2(A) + cos^2(A) = 1',
                  'Heights and Distances: Angle of Elevation and Depression',
                ],
              },
            ],
          },
          {
            name: 'Social Science',
            chapters: [
              {
                name: 'The Rise of Nationalism in Europe',
                isFree: true,
                bullets: [
                  'The French Revolution and the Idea of the Nation',
                  'The Making of Nationalism in Europe and Liberal Nationalism',
                  'Unification of Germany and Italy: Bismarck and Cavour',
                  'Visualizing the Nation: Marianne and Germania allegories',
                ],
              },
              {
                name: 'Resources and Development',
                bullets: [
                  'Classification of Resources: Biotic, Abiotic, Renewable',
                  'Resource Planning in India and Sustainable Development',
                  'Land degradation causes and soil conservation methods',
                  'Types of Soils in India: Alluvial, Black, Red and Laterite',
                ],
              },
              {
                name: 'Power Sharing & Federalism',
                bullets: [
                  'Case studies of Belgium and Sri Lanka ethnic diversity',
                  'Why power sharing is desirable: Prudential and Moral reasons',
                  'Federal vs Unitary government structures and decentralization in India',
                  'Key features of Indian Federalism: Union, State, Concurrent lists',
                ],
              },
              {
                name: 'Development & Sectors of Indian Economy',
                bullets: [
                  'Income and other development goals: HDI and per capita income',
                  'Primary, Secondary, and Tertiary sectors in India',
                  'Rising importance of the Tertiary sector in Indian GDP',
                  'Employment generation and MGNREGA 2005 provisions',
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Class 12 (Science)',
        monthlyPrice: 59900,
        annualPrice: 349900,
        subjects: [
          {
            name: 'Physics',
            chapters: [
              {
                name: 'Electric Charges and Fields',
                isFree: true,
                bullets: [
                  "Coulomb's Law in vector form and Principle of Superposition",
                  'Electric field lines and Electric dipole moment (p = 2aq)',
                  "Gauss's Theorem and its applications to line, sheet, spherical shell",
                  'Torque on a dipole in uniform external electric field',
                ],
              },
              {
                name: 'Electrostatic Potential and Capacitance',
                bullets: [
                  'Electric potential due to point charge and dipole',
                  'Equipotential surfaces and relationship E = -dV/dr',
                  'Capacitance of parallel plate capacitor with dielectric slab',
                  'Energy stored in a capacitor: U = 1/2 CV^2',
                ],
              },
              {
                name: 'Current Electricity',
                bullets: [
                  'Drift velocity and relation with electric current (I = n e A v_d)',
                  "Kirchhoff's Rules (KCL & KVL) and Wheatstone Bridge circuit",
                  'Internal resistance, EMF, and terminal potential difference of a cell',
                  'Cells in series and parallel combinations',
                ],
              },
              {
                name: 'Moving Charges and Magnetism',
                bullets: [
                  'Biot-Savart Law and magnetic field on axis of circular loop',
                  "Ampere's Circuital Law and solenoid magnetic field",
                  'Force on moving charge: Lorentz force (F = q(E + v x B))',
                  'Moving Coil Galvanometer: conversion to Ammeter and Voltmeter',
                ],
              },
              {
                name: 'Electromagnetic Induction & AC',
                bullets: [
                  "Faraday's Laws of Induction and Lenz's Law",
                  'Self-inductance and Mutual inductance coefficients',
                  'LCR Series Circuit: Resonance frequency (omega = 1 / sqrt(LC))',
                  'Transformer: Step-up and Step-down principle and energy losses',
                ],
              },
              {
                name: 'Ray Optics and Optical Instruments',
                bullets: [
                  'Refraction at spherical surfaces and Lens Maker Formula',
                  'Total Internal Reflection (TIR) and optical fibers',
                  'Prism formula: refractive index n = sin((A + Dm)/2) / sin(A/2)',
                  'Compound Microscope and Astronomical Telescope magnifying power',
                ],
              },
            ],
          },
          {
            name: 'Chemistry',
            chapters: [
              {
                name: 'Solutions & Colligative Properties',
                isFree: true,
                bullets: [
                  "Raoult's Law for volatile and non-volatile solutes",
                  'Ideal and non-ideal solutions with positive & negative deviations',
                  'Colligative properties: Relative lowering of vapor pressure, Osmotic pressure',
                  "Elevation in boiling point and Depression in freezing point, Van't Hoff factor",
                ],
              },
              {
                name: 'Electrochemistry',
                bullets: [
                  'Nernst Equation and calculation of cell EMF under standard/non-standard states',
                  "Kohlrausch's Law of Independent Migration of Ions",
                  "Faraday's Laws of Electrolysis: m = Z * I * t",
                  'Batteries: Lead Storage Cell, Dry Cell, and Fuel Cells',
                ],
              },
              {
                name: 'Chemical Kinetics',
                bullets: [
                  'Rate of reaction, Rate law, Order, and Molecularity of reaction',
                  'Integrated rate equations for zero and first order reactions',
                  'Half-life period (t_1/2 = 0.693 / k for first order)',
                  'Arrhenius equation and activation energy (Ea) graphical determination',
                ],
              },
              {
                name: 'Coordination Compounds',
                bullets: [
                  "Werner's Theory and IUPAC nomenclature of coordination entities",
                  'Isomerism: Geometrical, Optical, Ionization, Linkage, Hydrate',
                  'Valence Bond Theory (VBT): Inner and outer orbital complexes',
                  'Crystal Field Theory (CFT): Crystal field splitting in octahedral & tetrahedral',
                ],
              },
              {
                name: 'Organic Chemistry: Haloalkanes and Haloarenes',
                bullets: [
                  'Nucleophilic substitution mechanisms: SN1 vs SN2 kinetics and stereochemistry',
                  'Elimination reactions: Saytzeff rule vs Hofmann rule',
                  'Electrophilic substitution in haloarenes (o, p directing nature)',
                  'Grignard reagents and organometallic synthesis reactions',
                ],
              },
            ],
          },
          {
            name: 'Mathematics',
            chapters: [
              {
                name: 'Relations and Functions',
                isFree: true,
                bullets: [
                  'Types of relations: Reflexive, Symmetric, Transitive, Equivalence relations',
                  'Types of functions: One-one (Injective) and Onto (Surjective) functions',
                  'Bijective functions and inverse of a function',
                  'Composition of functions: fog and gof mappings',
                ],
              },
              {
                name: 'Matrices and Determinants',
                bullets: [
                  'Matrix multiplication, Transpose, and symmetric/skew-symmetric matrices',
                  'Properties of determinants and minors/cofactors calculation',
                  'Adjoint and Inverse of a matrix: A^-1 = adj(A) / det(A)',
                  'Solving system of linear equations using Matrix Method (AX = B)',
                ],
              },
              {
                name: 'Continuity and Differentiability',
                bullets: [
                  'Continuity of functions at a point and on an interval',
                  'Chain rule, logarithmic differentiation, and parametric differentiation',
                  "Second order derivatives: d^2y / dx^2",
                  "Rolle's Theorem and Mean Value Theorem applications",
                ],
              },
              {
                name: 'Integrals & Differential Equations',
                bullets: [
                  'Methods of Integration: Substitution, Partial Fractions, and By Parts',
                  'Definite integrals and fundamental properties of definite integrals',
                  'Separation of variables and homogeneous differential equations',
                  'Linear Differential Equations: dy/dx + Py = Q with Integrating Factor (I.F.)',
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Class 9',
        monthlyPrice: 39900,
        annualPrice: 249900,
        subjects: [
          {
            name: 'Science',
            chapters: [
              {
                name: 'Matter in Our Surroundings',
                isFree: true,
                bullets: [
                  'Physical nature of matter and particulate theory',
                  'States of matter: Solid, Liquid, Gas, Plasma, BEC',
                  'Latent heat of fusion and latent heat of vaporization',
                  'Evaporation and factors affecting rate of evaporation',
                ],
              },
              {
                name: 'Motion, Force and Laws of Motion',
                bullets: [
                  'Distance vs Displacement and Uniform vs Non-uniform motion',
                  'Three equations of motion: v = u + at, s = ut + 1/2 at^2, v^2 - u^2 = 2as',
                  "Newton's Three Laws of Motion: Inertia, F = ma, Action-Reaction",
                  'Conservation of linear momentum during collisions',
                ],
              },
              {
                name: 'Gravitation & Floatation',
                bullets: [
                  'Universal Law of Gravitation: F = G * m1 * m2 / r^2',
                  'Free fall and acceleration due to gravity (g = 9.8 m/s^2)',
                  'Mass vs Weight differences on Earth and Moon',
                  "Archimedes' Principle, Buoyant force, and Relative density",
                ],
              },
            ],
          },
          {
            name: 'Mathematics',
            chapters: [
              {
                name: 'Number Systems',
                isFree: true,
                bullets: [
                  'Real numbers, rational numbers, and irrational representations',
                  'Rationalization of denominators with surds',
                  'Laws of integral exponents for real numbers',
                  'Representation of sqrt(x) on number line geometrically',
                ],
              },
              {
                name: 'Lines, Angles and Triangles',
                bullets: [
                  'Intersecting and non-intersecting lines, transversal angle properties',
                  'Angle sum property of triangle and exterior angle theorem',
                  'Congruence criteria of triangles: SAS, ASA, AAS, SSS, RHS',
                  'Inequalities in a triangle and geometric proofs',
                ],
              },
              {
                name: 'Linear Equations in Two Variables',
                bullets: [
                  'Standard form: ax + by + c = 0',
                  'Solutions of a linear equation on coordinate grid',
                  'Graph of a linear equation and parallel lines to axes',
                  'Formulating equations from geometric and algebraic word problems',
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Class 11 (Science)',
        monthlyPrice: 54900,
        annualPrice: 319900,
        subjects: [
          {
            name: 'Physics',
            chapters: [
              {
                name: 'Units and Measurements',
                isFree: true,
                bullets: [
                  'SI units, fundamental and derived physical quantities',
                  'Dimensional analysis: principle of homogeneity and formula verification',
                  'Errors in measurement: Absolute, Relative, and Percentage errors',
                  'Significant figures and rounding rules in calculations',
                ],
              },
              {
                name: 'Laws of Motion and Work Energy Power',
                bullets: [
                  'Concept of force, inertia, and equilibrium of concurrent forces',
                  'Static and Kinetic friction, laws of friction, angle of repose',
                  'Work done by constant and variable force: Work-Energy Theorem',
                  'Conservative vs non-conservative forces and power calculations',
                ],
              },
            ],
          },
          {
            name: 'Chemistry',
            chapters: [
              {
                name: 'Some Basic Concepts of Chemistry',
                isFree: true,
                bullets: [
                  'Atomic and molecular masses, mole concept, and molar mass',
                  'Empirical and molecular formula determination from percentage composition',
                  'Stoichiometric calculations and limiting reagent concepts',
                  'Concentration units: Molarity, Molality, Mole fraction, ppm',
                ],
              },
              {
                name: 'Structure of Atom & Chemical Bonding',
                bullets: [
                  "Bohr's model of atom and de Broglie matter wave relation",
                  'Heisenberg Uncertainty Principle and Quantum Numbers (n, l, m, s)',
                  'VSEPR theory for molecular geometry prediction',
                  'Hybridization (sp, sp2, sp3, sp3d) and Molecular Orbital Theory',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'ICSE',
    classes: [
      {
        name: 'Class 10 (ICSE)',
        monthlyPrice: 49900,
        annualPrice: 299900,
        subjects: [
          {
            name: 'Physics',
            chapters: [
              {
                name: 'Force, Work, Power and Energy',
                isFree: true,
                bullets: [
                  'Turning effect of force: Moment of force and couple',
                  'Equilibrium conditions and center of gravity',
                  'Machines: Mechanical Advantage, Velocity Ratio, Efficiency',
                  'Conservation of mechanical energy during free fall',
                ],
              },
              {
                name: 'Light: Refraction and Spectrum',
                bullets: [
                  'Refraction of light through glass prism and triangular prisms',
                  'Total Internal Reflection and Critical Angle in water and glass',
                  'Electromagnetic spectrum: UV, Visible, IR, X-rays, Gamma rays',
                  'Scattering of light and Rayleigh scattering applications',
                ],
              },
              {
                name: 'Sound and Radioactivity',
                bullets: [
                  'Echoes, calculation of distance using sound reflection',
                  'Natural, Damped, and Forced vibrations with resonance examples',
                  'Radioactivity: Alpha, Beta, Gamma radiation characteristics',
                  'Nuclear fission and nuclear fusion comparison and safety measures',
                ],
              },
            ],
          },
          {
            name: 'Mathematics',
            chapters: [
              {
                name: 'Commercial Mathematics & GST',
                isFree: true,
                bullets: [
                  'Goods and Services Tax (GST): Intra-state vs Inter-state transactions',
                  'Input Tax Credit (ITC) mechanism and net tax liability',
                  'Banking: Recurring Deposit (RD) accounts interest and maturity value',
                  'Shares and Dividends: Nominal value, Market value, and Return rate',
                ],
              },
              {
                name: 'Algebra: Quadratic Equations & Matrices',
                bullets: [
                  'Solving quadratic equations by formula and factorization',
                  'Nature of roots and word problems on speed and distance',
                  'Matrix operations: Addition, subtraction, scalar multiplication',
                  'Multiplication of 2x2 matrices and compatibility condition',
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Class 12 (ISC Science)',
        monthlyPrice: 59900,
        annualPrice: 349900,
        subjects: [
          {
            name: 'Physics',
            chapters: [
              {
                name: 'Electrostatics & Dielectrics',
                isFree: true,
                bullets: [
                  "Coulomb's Law, Electric field intensity, and Electric dipole",
                  "Gauss's Theorem and applications to charged spherical shells",
                  'Capacitor dielectric properties and energy density formula',
                  'Combinations of capacitors in circuits',
                ],
              },
              {
                name: 'Current Electricity & Magnetism',
                bullets: [
                  "Ohm's Law, Kirchhoff's Circuit Laws, and Potentiometer experiments",
                  'Magnetic effect of electric current: Biot-Savart Law',
                  'Hysteresis loop and magnetic materials classification',
                  'Electromagnetic waves: properties and wave propagation equations',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Maharashtra State Board',
    classes: [
      {
        name: 'Class 10 (SSC)',
        monthlyPrice: 39900,
        annualPrice: 249900,
        subjects: [
          {
            name: 'Science & Technology',
            chapters: [
              {
                name: 'Gravitation & Effects of Electric Current',
                isFree: true,
                bullets: [
                  "Kepler's Three Laws of Planetary Motion",
                  'Newton Universal Law of Gravitation and Escape Velocity',
                  'Heating effect of electric current and electric power',
                  "Magnetic effect: Fleming's Right and Left Hand Rules",
                ],
              },
              {
                name: 'Periodic Classification of Elements',
                bullets: [
                  "Dobereiner's Triads and Newlands' Law of Octaves",
                  "Mendeleev's Periodic Table merits and demerits",
                  'Modern Periodic Table: Groups, Periods, and Periodic Trends',
                  'Valency, Atomic Size, Metallic and Non-metallic characters',
                ],
              },
            ],
          },
          {
            name: 'Mathematics (Algebra)',
            chapters: [
              {
                name: 'Linear Equations in Two Variables',
                isFree: true,
                bullets: [
                  'Simultaneous linear equations solution methods',
                  "Determinant Method (Cramer's Rule)",
                  'Graphical method of solving simultaneous equations',
                  'Equations reducible to pair of linear equations',
                ],
              },
              {
                name: 'Quadratic Equations & Financial Planning',
                bullets: [
                  'Solutions of quadratic equations by Completing Square method',
                  'Relation between roots and coefficients',
                  'GST in financial planning and Brokerage calculations',
                  'Mutual funds: NAV and SIP investment basics',
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Class 12 (HSC Science)',
        monthlyPrice: 54900,
        annualPrice: 329900,
        subjects: [
          {
            name: 'Physics',
            chapters: [
              {
                name: 'Rotational Dynamics',
                isFree: true,
                bullets: [
                  'Characteristics of Circular Motion: Centripetal & Centrifugal force',
                  'Vehicle on banked road maximum safe velocity derivation',
                  'Moment of Inertia and Theorems of Parallel & Perpendicular Axes',
                  'Rolling motion: Kinetic energy without slipping',
                ],
              },
              {
                name: 'Mechanical Properties of Fluids',
                bullets: [
                  "Pressure in a fluid column and Pascal's Law applications",
                  'Surface Tension, Surface Energy, and Angle of Contact',
                  'Capillary action and ascent formula derivation',
                  "Bernoulli's Principle and equation of continuity",
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

async function main() {
  console.log('🌱 Starting comprehensive database seed...');

  // 1. Clean existing tables in dependency order
  console.log('🧹 Purging old data...');
  await prisma.webhookEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.entitlement.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.material.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.class.deleteMany();
  await prisma.board.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Tables cleaned.');

  // 2. Seed Users
  console.log('👥 Creating users...');
  const adminPassword = await bcrypt.hash('admin123', 10);
  const studentPassword = await bcrypt.hash('student123', 10);

  const admin1 = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      password: adminPassword,
      name: 'System Admin',
      role: Role.ADMIN,
    },
  });

  const admin2 = await prisma.user.create({
    data: {
      email: 'admin@edtech.com',
      password: adminPassword,
      name: 'Operations Admin',
      role: Role.ADMIN,
    },
  });

  const student1 = await prisma.user.create({
    data: {
      email: 'student@test.com',
      password: studentPassword,
      name: 'Aravind Sharma',
      role: Role.STUDENT,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      email: 'priya.sharma@example.com',
      password: studentPassword,
      name: 'Priya Sharma',
      role: Role.STUDENT,
    },
  });

  const student3 = await prisma.user.create({
    data: {
      email: 'rohit.kumar@example.com',
      password: studentPassword,
      name: 'Rohit Kumar',
      role: Role.STUDENT,
    },
  });

  const student4 = await prisma.user.create({
    data: {
      email: 'ananya.verma@example.com',
      password: studentPassword,
      name: 'Ananya Verma',
      role: Role.STUDENT,
    },
  });

  console.log(`✅ Created 2 Admins (${admin1.email}, ${admin2.email}) and 4 Students.`);

  // 3. Seed Coupons
  console.log('🏷️ Creating discount coupons...');
  await prisma.coupon.createMany({
    data: [
      {
        code: 'WELCOME10',
        discountPercent: 10,
        active: true,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      },
      {
        code: 'EDTECH25',
        discountPercent: 25,
        active: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      {
        code: 'FLAT50',
        discountPaise: 5000, // ₹50
        active: true,
        expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      },
      {
        code: 'FLAT100',
        discountPaise: 10000, // ₹100
        active: true,
        expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      },
      {
        code: 'EXPIRED20',
        discountPercent: 20,
        active: true,
        expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Expired 10 days ago
      },
    ],
  });
  console.log('✅ Created 5 coupons.');

  // 4. Seed Hierarchy & Products
  console.log('📚 Building Boards, Classes, Subjects, Chapters, Materials, and Products...');

  // Track entities for orders/entitlements
  let cbseClass10Id = '';
  let cbseClass10AnnualPassProduct: any = null;
  let cbseClass12PhysicsSubjectId = '';
  let cbseClass12PhysicsSubjectPackProduct: any = null;
  let cbseClass12ChemistryCh2Id = '';
  let cbseClass12ChemistryCh3Id = '';
  let cbseClass12ChemistryCh2Product: any = null;
  let cbseClass12ChemistryCh3Product: any = null;

  let icseClass10MathSubjectPackProduct: any = null;
  let maharashtraClass10MonthlyPassProduct: any = null;
  let cbseClass12AnnualPassProduct: any = null;
  let cbseClass12BiologySubjectPackProduct: any = null;
  let icseClass12MonthlyPassProduct: any = null;
  let maharashtraClass12PhysicsSubjectPackProduct: any = null;

  for (const boardData of BOARDS_DATA) {
    const board = await prisma.board.create({
      data: { name: boardData.name },
    });
    console.log(`  📌 Board: ${board.name}`);

    for (const classData of boardData.classes) {
      const classRecord = await prisma.class.create({
        data: {
          name: classData.name,
          boardId: board.id,
        },
      });

      if (boardData.name === 'CBSE' && classData.name === 'Class 10') {
        cbseClass10Id = classRecord.id;
      }

      // Create Class Pass Products (Monthly & Annual)
      const monthlyPass = await prisma.product.create({
        data: {
          title: `${board.name} ${classRecord.name} Monthly Pass (30 Days)`,
          type: ProductType.MONTHLY_PASS,
          targetId: classRecord.id,
          pricePaise: classData.monthlyPrice,
          active: true,
        },
      });

      const annualPass = await prisma.product.create({
        data: {
          title: `${board.name} ${classRecord.name} Annual Pass (365 Days)`,
          type: ProductType.ANNUAL_PASS,
          targetId: classRecord.id,
          pricePaise: classData.annualPrice,
          active: true,
        },
      });

      if (boardData.name === 'CBSE' && classData.name === 'Class 10') {
        cbseClass10AnnualPassProduct = annualPass;
      } else if (boardData.name === 'CBSE' && classData.name === 'Class 12 (Science)') {
        cbseClass12AnnualPassProduct = annualPass;
      } else if (boardData.name === 'Maharashtra State Board' && classData.name === 'Class 10 (SSC)') {
        maharashtraClass10MonthlyPassProduct = monthlyPass;
      } else if (boardData.name === 'ICSE' && classData.name === 'Class 12 (ISC Science)') {
        icseClass12MonthlyPassProduct = monthlyPass;
      }

      for (const subjectData of classData.subjects) {
        const subjectRecord = await prisma.subject.create({
          data: {
            name: subjectData.name,
            classId: classRecord.id,
          },
        });

        // Create Subject Pack Product (Lifetime)
        const subjectPackProduct = await prisma.product.create({
          data: {
            title: `${classRecord.name} - ${subjectRecord.name} Full Subject Pack`,
            type: ProductType.SUBJECT_PACK,
            targetId: subjectRecord.id,
            pricePaise: 19900, // ₹199
            active: true,
          },
        });

        if (boardData.name === 'CBSE' && classData.name === 'Class 12 (Science)' && subjectData.name === 'Physics') {
          cbseClass12PhysicsSubjectId = subjectRecord.id;
          cbseClass12PhysicsSubjectPackProduct = subjectPackProduct;
        } else if (boardData.name === 'ICSE' && classData.name === 'Class 10 (ICSE)' && subjectData.name === 'Mathematics') {
          icseClass10MathSubjectPackProduct = subjectPackProduct;
        } else if (boardData.name === 'CBSE' && classData.name === 'Class 12 (Science)' && subjectData.name === 'Biology') {
          cbseClass12BiologySubjectPackProduct = subjectPackProduct;
        } else if (boardData.name === 'Maharashtra State Board' && classData.name === 'Class 12 (HSC Science)' && subjectData.name === 'Physics') {
          maharashtraClass12PhysicsSubjectPackProduct = subjectPackProduct;
        }

        // Create Chapters & Materials
        let order = 1;
        for (const chData of subjectData.chapters) {
          const isFree = chData.isFree === true;

          const chapterRecord = await prisma.chapter.create({
            data: {
              name: chData.name,
              order: order++,
              isFree: isFree,
              subjectId: subjectRecord.id,
            },
          });

          // Generate real PDF file on disk
          const cleanSlug = `${board.name.toLowerCase()}-${classRecord.name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${subjectRecord.name.toLowerCase().replace(/[^a-z0-9]/g, '')}-ch${order - 1}`;
          const pdfFileName = `${cleanSlug}.pdf`;
          const pdfRelativePath = `uploads/${pdfFileName}`;
          const pdfFullPath = path.resolve(UPLOADS_DIR, pdfFileName);

          const pdfBuffer = createPdfBuffer(
            `${classRecord.name} ${subjectRecord.name}: ${chapterRecord.name}`,
            `Board: ${board.name} | Curriculum Standard 2026-27`,
            chData.bullets
          );
          fs.writeFileSync(pdfFullPath, pdfBuffer);

          // Create Material record
          await prisma.material.create({
            data: {
              title: `${chapterRecord.name} - Comprehensive Notes (PDF)`,
              filePath: pdfRelativePath,
              chapterId: chapterRecord.id,
            },
          });

          // If paid, create a CHAPTER product
          if (!isFree) {
            const chProduct = await prisma.product.create({
              data: {
                title: `${subjectRecord.name}: ${chapterRecord.name} Access`,
                type: ProductType.CHAPTER,
                targetId: chapterRecord.id,
                pricePaise: 4900, // ₹49
                active: true,
              },
            });

            if (boardData.name === 'CBSE' && classData.name === 'Class 12 (Science)' && subjectData.name === 'Chemistry') {
              if (order - 1 === 2) {
                cbseClass12ChemistryCh2Id = chapterRecord.id;
                cbseClass12ChemistryCh2Product = chProduct;
              } else if (order - 1 === 3) {
                cbseClass12ChemistryCh3Id = chapterRecord.id;
                cbseClass12ChemistryCh3Product = chProduct;
              }
            }
          }
        }
      }
    }
  }

  console.log('✅ Academic Hierarchy, PDFs, and Products seeded successfully.');

  // 5. Seed Realistic Orders, Payments & Student Entitlements
  console.log('💳 Seeding realistic Orders, Transactions, and Entitlements...');

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const twelveDaysAgo = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000);

  // --- ORDER 1: Student 1 buys Class 10 Annual Pass (PAID) ---
  if (cbseClass10AnnualPassProduct) {
    const order1 = await prisma.order.create({
      data: {
        userId: student1.id,
        status: OrderStatus.PAID,
        amountPaise: cbseClass10AnnualPassProduct.pricePaise,
        razorpayOrderId: 'order_seed_001_cl10pass',
        createdAt: twelveDaysAgo,
        items: {
          create: {
            productId: cbseClass10AnnualPassProduct.id,
            pricePaise: cbseClass10AnnualPassProduct.pricePaise,
            createdAt: twelveDaysAgo,
          },
        },
        payments: {
          create: {
            razorpayPaymentId: 'pay_seed_001_cl10pass',
            razorpaySignature: 'sig_seed_001_verified',
            amountPaise: cbseClass10AnnualPassProduct.pricePaise,
            status: 'captured',
            createdAt: twelveDaysAgo,
          },
        },
      },
    });

    // Grant CLASS_PASS entitlement for 365 days
    await prisma.entitlement.create({
      data: {
        userId: student1.id,
        scope: EntitlementScope.CLASS_PASS,
        refId: cbseClass10Id,
        expiresAt: new Date(now.getTime() + 353 * 24 * 60 * 60 * 1000), // ~353 days left
        sourceOrderId: order1.id,
        reason: 'Order #order_seed_001_cl10pass verified',
        createdAt: twelveDaysAgo,
      },
    });
  }

  // --- ORDER 2: Student 1 buys Class 12 Physics Subject Pack (PAID) ---
  if (cbseClass12PhysicsSubjectPackProduct) {
    const order2 = await prisma.order.create({
      data: {
        userId: student1.id,
        status: OrderStatus.PAID,
        amountPaise: cbseClass12PhysicsSubjectPackProduct.pricePaise,
        razorpayOrderId: 'order_seed_002_phy12',
        createdAt: sevenDaysAgo,
        items: {
          create: {
            productId: cbseClass12PhysicsSubjectPackProduct.id,
            pricePaise: cbseClass12PhysicsSubjectPackProduct.pricePaise,
            createdAt: sevenDaysAgo,
          },
        },
        payments: {
          create: {
            razorpayPaymentId: 'pay_seed_002_phy12',
            razorpaySignature: 'sig_seed_002_verified',
            amountPaise: cbseClass12PhysicsSubjectPackProduct.pricePaise,
            status: 'captured',
            createdAt: sevenDaysAgo,
          },
        },
      },
    });

    // Grant SUBJECT entitlement (Lifetime)
    await prisma.entitlement.create({
      data: {
        userId: student1.id,
        scope: EntitlementScope.SUBJECT,
        refId: cbseClass12PhysicsSubjectId,
        expiresAt: null, // Lifetime
        sourceOrderId: order2.id,
        reason: 'Order #order_seed_002_phy12 verified',
        createdAt: sevenDaysAgo,
      },
    });
  }

  // --- ORDER 3: Student 1 buys Class 12 Chemistry Ch 2 & Ch 3 (PAID) ---
  if (cbseClass12ChemistryCh2Product && cbseClass12ChemistryCh3Product) {
    const totalAmount = cbseClass12ChemistryCh2Product.pricePaise + cbseClass12ChemistryCh3Product.pricePaise;
    const order3 = await prisma.order.create({
      data: {
        userId: student1.id,
        status: OrderStatus.PAID,
        amountPaise: totalAmount,
        razorpayOrderId: 'order_seed_003_chem_chs',
        createdAt: threeDaysAgo,
        items: {
          create: [
            {
              productId: cbseClass12ChemistryCh2Product.id,
              pricePaise: cbseClass12ChemistryCh2Product.pricePaise,
              createdAt: threeDaysAgo,
            },
            {
              productId: cbseClass12ChemistryCh3Product.id,
              pricePaise: cbseClass12ChemistryCh3Product.pricePaise,
              createdAt: threeDaysAgo,
            },
          ],
        },
        payments: {
          create: {
            razorpayPaymentId: 'pay_seed_003_chem_chs',
            razorpaySignature: 'sig_seed_003_verified',
            amountPaise: totalAmount,
            status: 'captured',
            createdAt: threeDaysAgo,
          },
        },
      },
    });

    // Grant CHAPTER entitlements (Lifetime)
    await prisma.entitlement.createMany({
      data: [
        {
          userId: student1.id,
          scope: EntitlementScope.CHAPTER,
          refId: cbseClass12ChemistryCh2Id,
          expiresAt: null,
          sourceOrderId: order3.id,
          reason: 'Order #order_seed_003_chem_chs verified',
          createdAt: threeDaysAgo,
        },
        {
          userId: student1.id,
          scope: EntitlementScope.CHAPTER,
          refId: cbseClass12ChemistryCh3Id,
          expiresAt: null,
          sourceOrderId: order3.id,
          reason: 'Order #order_seed_003_chem_chs verified',
          createdAt: threeDaysAgo,
        },
      ],
    });
  }

  // --- ORDER 4: Priya Sharma buys ICSE Class 10 Math Subject Pack (PAID) ---
  if (icseClass10MathSubjectPackProduct) {
    await prisma.order.create({
      data: {
        userId: student2.id,
        status: OrderStatus.PAID,
        amountPaise: icseClass10MathSubjectPackProduct.pricePaise,
        razorpayOrderId: 'order_seed_004_icse_math',
        createdAt: tenDaysAgo,
        items: {
          create: {
            productId: icseClass10MathSubjectPackProduct.id,
            pricePaise: icseClass10MathSubjectPackProduct.pricePaise,
            createdAt: tenDaysAgo,
          },
        },
        payments: {
          create: {
            razorpayPaymentId: 'pay_seed_004_icse_math',
            razorpaySignature: 'sig_seed_004_verified',
            amountPaise: icseClass10MathSubjectPackProduct.pricePaise,
            status: 'captured',
            createdAt: tenDaysAgo,
          },
        },
      },
    });
  }

  // --- ORDER 5: Rohit Kumar buys Maharashtra SSC Class 10 Monthly Pass (PAID) ---
  if (maharashtraClass10MonthlyPassProduct) {
    await prisma.order.create({
      data: {
        userId: student3.id,
        status: OrderStatus.PAID,
        amountPaise: maharashtraClass10MonthlyPassProduct.pricePaise,
        razorpayOrderId: 'order_seed_005_maha_pass',
        createdAt: fiveDaysAgo,
        items: {
          create: {
            productId: maharashtraClass10MonthlyPassProduct.id,
            pricePaise: maharashtraClass10MonthlyPassProduct.pricePaise,
            createdAt: fiveDaysAgo,
          },
        },
        payments: {
          create: {
            razorpayPaymentId: 'pay_seed_005_maha_pass',
            razorpaySignature: 'sig_seed_005_verified',
            amountPaise: maharashtraClass10MonthlyPassProduct.pricePaise,
            status: 'captured',
            createdAt: fiveDaysAgo,
          },
        },
      },
    });
  }

  // --- ORDER 6: Ananya Verma buys CBSE Class 12 Annual Pass (PAID) ---
  if (cbseClass12AnnualPassProduct) {
    await prisma.order.create({
      data: {
        userId: student4.id,
        status: OrderStatus.PAID,
        amountPaise: cbseClass12AnnualPassProduct.pricePaise,
        razorpayOrderId: 'order_seed_006_cbse12_pass',
        createdAt: oneDayAgo,
        items: {
          create: {
            productId: cbseClass12AnnualPassProduct.id,
            pricePaise: cbseClass12AnnualPassProduct.pricePaise,
            createdAt: oneDayAgo,
          },
        },
        payments: {
          create: {
            razorpayPaymentId: 'pay_seed_006_cbse12_pass',
            razorpaySignature: 'sig_seed_006_verified',
            amountPaise: cbseClass12AnnualPassProduct.pricePaise,
            status: 'captured',
            createdAt: oneDayAgo,
          },
        },
      },
    });
  }

  // --- ORDER 7: Student 1 has a CREATED pending order (Pending payment) ---
  if (cbseClass12BiologySubjectPackProduct) {
    await prisma.order.create({
      data: {
        userId: student1.id,
        status: OrderStatus.CREATED,
        amountPaise: cbseClass12BiologySubjectPackProduct.pricePaise,
        razorpayOrderId: 'order_seed_007_pending',
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        items: {
          create: {
            productId: cbseClass12BiologySubjectPackProduct.id,
            pricePaise: cbseClass12BiologySubjectPackProduct.pricePaise,
            createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          },
        },
      },
    });
  }

  // --- ORDER 8: Priya Sharma had a FAILED payment order ---
  if (icseClass12MonthlyPassProduct) {
    await prisma.order.create({
      data: {
        userId: student2.id,
        status: OrderStatus.FAILED,
        amountPaise: icseClass12MonthlyPassProduct.pricePaise,
        razorpayOrderId: 'order_seed_008_failed',
        createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        items: {
          create: {
            productId: icseClass12MonthlyPassProduct.id,
            pricePaise: icseClass12MonthlyPassProduct.pricePaise,
            createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
          },
        },
        payments: {
          create: {
            razorpayPaymentId: 'pay_seed_008_failed',
            amountPaise: icseClass12MonthlyPassProduct.pricePaise,
            status: 'failed',
            createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
  }

  // --- ORDER 9: Rohit Kumar buys Maharashtra Class 12 HSC Physics Subject Pack (PAID) ---
  if (maharashtraClass12PhysicsSubjectPackProduct) {
    await prisma.order.create({
      data: {
        userId: student3.id,
        status: OrderStatus.PAID,
        amountPaise: maharashtraClass12PhysicsSubjectPackProduct.pricePaise,
        razorpayOrderId: 'order_seed_009_maha_phy12',
        createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        items: {
          create: {
            productId: maharashtraClass12PhysicsSubjectPackProduct.id,
            pricePaise: maharashtraClass12PhysicsSubjectPackProduct.pricePaise,
            createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
          },
        },
        payments: {
          create: {
            razorpayPaymentId: 'pay_seed_009_maha_phy12',
            razorpaySignature: 'sig_seed_009_verified',
            amountPaise: maharashtraClass12PhysicsSubjectPackProduct.pricePaise,
            status: 'captured',
            createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
  }

  console.log('✅ Seed completed successfully with full rich data!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
