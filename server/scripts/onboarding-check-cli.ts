import { OnboardingCheckService } from '../services/onboarding-check-service';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
config({ path: resolve(process.cwd(), '.env') });

async function runOnboardingChecks() {
  const service = new OnboardingCheckService();

  const dbConnectionUrl = process.env.NEON_SHARED_DATABASE_URL;
  const skillsDirectory = process.env.AGENT_SKILLS_DIRECTORY || resolve(process.cwd(), '.agents/skills');

  if (!dbConnectionUrl) {
    console.error('Error: NEON_SHARED_DATABASE_URL is not set.');
    process.exit(1);
  }

  console.log('\n--- Running Onboarding Checks ---');
  console.log(`Using DB URL: ${dbConnectionUrl ? '(set)' : '(not set)'}`);
  console.log(`Using Skills Directory: ${skillsDirectory}`);

  const { success, results } = await service.runFullOnboardingCheck(dbConnectionUrl, skillsDirectory);

  console.log('\n--- Onboarding Check Results ---');
  console.log(JSON.stringify(results, null, 2));

  if (success) {
    console.log('\n✅ All onboarding checks passed successfully.');
    process.exit(0);
  } else {
    console.error('\n❌ One or more onboarding checks failed.');
    process.exit(1);
  }
}

runOnboardingChecks();
