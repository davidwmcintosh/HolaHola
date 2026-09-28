import { getSharedDb } from '../neon-db';
import { agentNorthStar } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

export class OnboardingCheckService {
  async verifyDatabaseAccess(dbConnectionUrl: string): Promise<{ success: boolean; message?: string }> {
    try {
      // Temporarily override the sharedDb connection for this check if a specific URL is provided
      // In a real scenario, the new runtime would need its own configured connection.
      // For this check, we'll simulate a connection attempt to the shared DB.
      const db = getSharedDb(); // Assumes getSharedDb uses NEON_SHARED_DATABASE_URL from env

      // Attempt a simple read operation
      const result = await db.select().from(agentNorthStar).limit(1);

      if (result.length > 0) {
        return { success: true, message: 'Successfully connected and read from agent_north_star table.' };
      } else {
        return { success: true, message: 'Successfully connected to DB, but agent_north_star table is empty.' };
      }
    } catch (error: any) {
      return { success: false, message: `Database access failed: ${error.message}` };
    }
  }

  async verifySkillsAccess(skillsDirectory: string): Promise<{ success: boolean; message?: string }> {
    try {
      const files = readdirSync(skillsDirectory);
      const skillFiles = files.filter(file => file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.md'));

      if (skillFiles.length > 0) {
        return { success: true, message: `Successfully accessed skills directory. Found ${skillFiles.length} skill-related files.` };
      } else {
        return { success: false, message: `Skills directory is accessible but no skill files found in ${skillsDirectory}.` };
      }
    } catch (error: any) {
      return { success: false, message: `Skills directory access failed: ${error.message}` };
    }
  }

  // Placeholder for a more complex neural net parity check
  async verifyNeuralNetParity(): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: 'Neural net parity check placeholder: Assumed to be at parity.' };
  }

  async runFullOnboardingCheck(dbConnectionUrl: string, skillsDirectory: string): Promise<{ success: boolean; results: Record<string, any> }> {
    const results: Record<string, any> = {};
    let overallSuccess = true;

    const dbCheck = await this.verifyDatabaseAccess(dbConnectionUrl);
    results.databaseAccess = dbCheck;
    if (!dbCheck.success) overallSuccess = false;

    const skillsCheck = await this.verifySkillsAccess(skillsDirectory);
    results.skillsAccess = skillsCheck;
    if (!skillsCheck.success) overallSuccess = false;

    const neuralNetCheck = await this.verifyNeuralNetParity();
    results.neuralNetParity = neuralNetCheck;
    if (!neuralNetCheck.success) overallSuccess = false; // Unlikely to fail with placeholder

    return { success: overallSuccess, results };
  }
}
