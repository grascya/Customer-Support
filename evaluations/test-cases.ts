// evaluations/test-cases.ts
export type TestCase = {
  id: string;
  question: string;
  expectedAnswer: string; // What the bot SHOULD say
  expectedSources: string[]; // Which files should be retrieved
  category: 'factual' | 'multi-doc' | 'ambiguous' | 'off-topic';
  difficulty: 'easy' | 'medium' | 'hard';
};

export const testCases: TestCase[] = [
  // ========== EASY - Single Document, Direct Facts ==========
  {
    id: 'test_001',
    question: 'What is the warranty period for Lumino devices?',
    expectedAnswer: '1-year limited warranty covering manufacturing defects',
    expectedSources: ['troubleshooting.txt'],
    category: 'factual',
    difficulty: 'easy',
  },
  {
    id: 'test_002',
    question: 'How much does Sentinel Plus cost?',
    expectedAnswer: '$4.99 per month',
    expectedSources: ['sentinel-plus.txt'],
    category: 'factual',
    difficulty: 'easy',
  },
  {
    id: 'test_003',
    question: 'What processor does the Lumino Hub use?',
    expectedAnswer: 'Quad-core 1.5GHz ARM Cortex',
    expectedSources: ['hardware-specs.txt'],
    category: 'factual',
    difficulty: 'easy',
  },
  {
    id: 'test_004',
    question: 'What is the wake word for voice commands?',
    expectedAnswer: 'Hey Lumino',
    expectedSources: ['technical-setup.txt'],
    category: 'factual',
    difficulty: 'easy',
  },

  // ========== MEDIUM - Multiple Documents ==========
  {
    id: 'test_005',
    question: 'What features do I get with Sentinel Plus and how do I cancel it?',
    expectedAnswer: 'Extended 30-day cloud storage, AI detection for people/pets/packages, and cellular backup. Cancel via Lumino Web Portal, takes effect at end of billing cycle.',
    expectedSources: ['sentinel-plus.txt'],
    category: 'multi-doc',
    difficulty: 'medium',
  },
  {
    id: 'test_006',
    question: 'How do I reset my hub and what does that erase?',
    expectedAnswer: 'Hold Sync button for 15 seconds while plugging in power. This erases all paired devices.',
    expectedSources: ['troubleshooting.txt'],
    category: 'factual',
    difficulty: 'medium',
  },
  {
    id: 'test_007',
    question: 'What integrations does the hub support and how do I set up HomeKit?',
    expectedAnswer: 'Supports HomeKit, Google Home, Alexa, and IFTTT. For HomeKit, scan the QR code on the bottom of the hub.',
    expectedSources: ['technical-setup.txt'],
    category: 'multi-doc',
    difficulty: 'medium',
  },
  {
    id: 'test_008',
    question: 'What are the temperature limits and is it waterproof?',
    expectedAnswer: '0°C to 40°C operating range, indoor use only, not IP-rated for moisture resistance.',
    expectedSources: ['hardware-specs.txt'],
    category: 'multi-doc',
    difficulty: 'medium',
  },

  // ========== HARD - Complex, Requires Synthesis ==========
  {
    id: 'test_009',
    question: 'I want all the premium features but my hub disconnects sometimes. What should I do?',
    expectedAnswer: 'Sentinel Plus includes cellular backup for Wi-Fi outages. If you have connection issues, check: 1) Red blinking light = wrong password, 2) Router within 10 meters, 3) Consider Sentinel Plus for LTE backup (North America only).',
    expectedSources: ['sentinel-plus.txt', 'troubleshooting.txt'],
    category: 'multi-doc',
    difficulty: 'hard',
  },
  {
    id: 'test_010',
    question: "Can I return the hub if I don't like it, and what's not covered by warranty?",
    expectedAnswer: '30-day money-back guarantee (must be in original packaging). 1-year warranty covers manufacturing defects but NOT water damage or drops.',
    expectedSources: ['troubleshooting.txt'],
    category: 'multi-doc',
    difficulty: 'hard',
  },
  {
    id: 'test_011',
    question: 'How do I keep my privacy secure while using voice commands?',
    expectedAnswer: 'Physical Privacy Toggle on the back manually disconnects microphone. Voice recordings encrypted locally and deleted after 24 hours. For remote control, activate Cloud Bridge in app.',
    expectedSources: ['technical-setup.txt', 'troubleshooting.txt'],
    category: 'multi-doc',
    difficulty: 'hard',
  },

  // ========== AMBIGUOUS / EDGE CASES ==========
  {
    id: 'test_012',
    question: 'Is it good?',
    expectedAnswer: 'Should ask clarifying question or mention key features',
    expectedSources: [],
    category: 'ambiguous',
    difficulty: 'medium',
  },
  {
    id: 'test_013',
    question: 'What about the thing?',
    expectedAnswer: 'Should ask for clarification',
    expectedSources: [],
    category: 'ambiguous',
    difficulty: 'easy',
  },

  // ========== OFF-TOPIC (Should Politely Decline) ==========
  {
    id: 'test_014',
    question: "What's the weather like today?",
    expectedAnswer: 'Should politely say this is outside its scope and redirect to Lumino questions',
    expectedSources: [],
    category: 'off-topic',
    difficulty: 'easy',
  },
  {
    id: 'test_015',
    question: 'Can you help me with my WiFi router settings?',
    expectedAnswer: 'Should focus on Lumino-specific connectivity, not general router help',
    expectedSources: ['troubleshooting.txt'],
    category: 'off-topic',
    difficulty: 'medium',
  },
];