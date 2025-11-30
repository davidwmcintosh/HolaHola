/**
 * Script to create Cartesia Pronunciation Dictionaries for each supported language
 * 
 * This uploads our MFA_IPA_PRONUNCIATIONS to Cartesia as persistent dictionaries,
 * allowing cleaner transcripts (no inline phoneme markers) and potentially better
 * word timing for subtitle synchronization.
 * 
 * Run with: npx tsx server/scripts/setup-cartesia-dictionaries.ts
 */

import { MFA_IPA_PRONUNCIATIONS } from '../services/tts-service';

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const CARTESIA_API_URL = 'https://api.cartesia.ai';
const CARTESIA_VERSION = '2025-04-16';

interface PronunciationDictItem {
  text: string;
  alias: string;
}

interface CreateDictRequest {
  name: string;
  items: PronunciationDictItem[];
}

interface DictResponse {
  id: string;
  name: string;
  owner_id: string;
  pinned: boolean;
  items: PronunciationDictItem[];
  created_at: string;
}

/**
 * List existing pronunciation dictionaries
 */
async function listDictionaries(): Promise<DictResponse[]> {
  const response = await fetch(`${CARTESIA_API_URL}/pronunciation-dicts/`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CARTESIA_API_KEY}`,
      'Cartesia-Version': CARTESIA_VERSION,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list dictionaries: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Delete a pronunciation dictionary by ID
 */
async function deleteDictionary(dictId: string): Promise<void> {
  const response = await fetch(`${CARTESIA_API_URL}/pronunciation-dicts/${dictId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${CARTESIA_API_KEY}`,
      'Cartesia-Version': CARTESIA_VERSION,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete dictionary ${dictId}: ${response.status} ${error}`);
  }
}

/**
 * Create a pronunciation dictionary for a specific language
 */
async function createDictionary(language: string, pronunciations: Record<string, string>): Promise<DictResponse> {
  const items: PronunciationDictItem[] = [];

  for (const [text, phonemes] of Object.entries(pronunciations)) {
    items.push({
      text: text,
      alias: `<<${phonemes}>>`,
    });
  }

  const request: CreateDictRequest = {
    name: `linguaflow-${language}`,
    items,
  };

  console.log(`Creating dictionary for ${language} with ${items.length} items...`);

  const response = await fetch(`${CARTESIA_API_URL}/pronunciation-dicts/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CARTESIA_API_KEY}`,
      'Cartesia-Version': CARTESIA_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create dictionary for ${language}: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Main function to set up all dictionaries
 */
async function main() {
  if (!CARTESIA_API_KEY) {
    console.error('Error: CARTESIA_API_KEY environment variable is not set');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Cartesia Pronunciation Dictionary Setup                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // First, check for existing dictionaries
  console.log('Step 1: Checking for existing LinguaFlow dictionaries...\n');
  
  try {
    const existingDicts = await listDictionaries();
    const linguaflowDicts = existingDicts.filter(d => d.name.startsWith('linguaflow-'));
    
    if (linguaflowDicts.length > 0) {
      console.log(`Found ${linguaflowDicts.length} existing LinguaFlow dictionaries:`);
      for (const dict of linguaflowDicts) {
        console.log(`  - ${dict.name} (ID: ${dict.id}, ${dict.items.length} items)`);
      }
      
      console.log('\nDeleting existing dictionaries to recreate with latest pronunciations...');
      for (const dict of linguaflowDicts) {
        await deleteDictionary(dict.id);
        console.log(`  ✓ Deleted ${dict.name}`);
      }
      console.log('');
    } else {
      console.log('No existing LinguaFlow dictionaries found.\n');
    }
  } catch (error) {
    console.log('Could not check existing dictionaries, proceeding with creation...\n');
  }

  // Create dictionaries for each language
  console.log('Step 2: Creating pronunciation dictionaries...\n');
  
  const results: Record<string, string> = {};
  
  for (const [language, pronunciations] of Object.entries(MFA_IPA_PRONUNCIATIONS)) {
    try {
      const dict = await createDictionary(language, pronunciations);
      results[language] = dict.id;
      console.log(`  ✓ ${language}: ${dict.id} (${dict.items.length} words)`);
    } catch (error) {
      console.error(`  ✗ ${language}: ${error}`);
    }
  }

  // Output the environment variable configuration
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Dictionary IDs Created Successfully                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('Add these to your environment variables or .env file:\n');
  console.log('─────────────────────────────────────────────────────────────');
  
  // Generate the JSON mapping for easy storage
  const dictionaryIds = JSON.stringify(results, null, 2);
  console.log(`CARTESIA_PRONUNCIATION_DICT_IDS='${JSON.stringify(results)}'`);
  
  console.log('─────────────────────────────────────────────────────────────');
  
  console.log('\nOr as individual environment variables:\n');
  for (const [language, id] of Object.entries(results)) {
    const envKey = `CARTESIA_DICT_${language.toUpperCase().replace(/\s+/g, '_')}`;
    console.log(`${envKey}=${id}`);
  }

  console.log('\n✓ Setup complete!\n');
  
  return results;
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
