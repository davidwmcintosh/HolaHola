import { seedScenarioTopics } from '../seed-scenario-topics';
seedScenarioTopics().then(() => {
  console.log('[Done] Scenario seeder complete');
  process.exit(0);
}).catch(err => {
  console.error('[Error]', err);
  process.exit(1);
});
