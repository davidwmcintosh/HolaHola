/**
 * Wren Session Startup Script
 * 
 * Run this at the start of each Wren session to sync with the Hive.
 * It fetches current Hive context and updates the memory file so
 * Wren has full awareness of beacons, sprints, sessions, and system state.
 * 
 * Usage: npx tsx scripts/wren-startup.ts
 */

const HIVE_API_BASE = 'http://localhost:5000';
const MEMORY_FILE = '.local/state/memory/persisted_information.md';

interface HiveContext {
  buildTimestamp: string;
  pendingBeacons: Array<{
    id: string;
    type: string;
    reason?: string;
    tutorTurn: string;
    channelId: string;
    createdAt: string;
  }>;
  recentPostFlights: Array<{
    id: string;
    featureName: string;
    verdict: string;
    requiredFixes: any[];
    shouldAddress: any[];
  }>;
  activeSprints: Array<{
    id: string;
    title: string;
    stage: string;
    priority: string;
    description?: string;
  }>;
  recentSessions: Array<{
    id: string;
    title: string;
    messageCount: number;
    lastActivity: string;
  }>;
  systemHealth: {
    pendingBeaconCount: number;
    unresolvedIssueCount: number;
    activeSprintCount: number;
    recentActivityLevel: 'high' | 'moderate' | 'low';
  };
  focusAreas: string[];
}

async function fetchHiveContext(): Promise<HiveContext | null> {
  const secret = process.env.ARCHITECT_SECRET;
  if (!secret) {
    console.error('❌ ARCHITECT_SECRET not set');
    return null;
  }

  try {
    const response = await fetch(`${HIVE_API_BASE}/api/hive/context?refresh=true`, {
      headers: { 'x-editor-secret': secret }
    });
    
    if (!response.ok) {
      console.error(`❌ Hive API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.context;
  } catch (error) {
    console.error('❌ Failed to fetch Hive context:', error);
    return null;
  }
}

function formatHiveContext(ctx: HiveContext): string {
  const lines: string[] = [];
  const now = new Date().toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  lines.push(`# Wren Session State - ${now}`);
  lines.push('');
  lines.push('## Hive Awareness (Auto-synced)');
  lines.push('');
  lines.push(`**System Health**: ${ctx.systemHealth.recentActivityLevel} activity`);
  lines.push(`**Last Sync**: ${new Date(ctx.buildTimestamp).toLocaleTimeString()}`);
  lines.push('');

  // Pending Beacons
  if (ctx.pendingBeacons.length > 0) {
    lines.push('### Pending Beacons (Daniela needs help)');
    lines.push('');
    ctx.pendingBeacons.forEach((b, i) => {
      lines.push(`${i + 1}. **${b.type}**${b.reason ? `: ${b.reason}` : ''}`);
      lines.push(`   - Context: ${b.tutorTurn.substring(0, 100)}...`);
    });
    lines.push('');
  } else {
    lines.push('### Pending Beacons');
    lines.push('No pending beacons - Daniela is managing well.');
    lines.push('');
  }

  // Active Sprints
  if (ctx.activeSprints.length > 0) {
    lines.push('### Active Sprints');
    lines.push('');
    ctx.activeSprints.forEach(s => {
      lines.push(`- **${s.title}** (${s.priority} priority)`);
      if (s.description) lines.push(`  ${s.description}`);
    });
    lines.push('');
  }

  // Recent Post-Flights with Issues
  const issueFlights = ctx.recentPostFlights.filter(pf => 
    pf.requiredFixes.length > 0 || pf.shouldAddress.length > 0
  );
  if (issueFlights.length > 0) {
    lines.push('### Post-Flight Issues');
    lines.push('');
    issueFlights.forEach(pf => {
      lines.push(`- **${pf.featureName}**: ${pf.verdict}`);
      if (pf.requiredFixes.length > 0) {
        lines.push(`  - Required fixes: ${pf.requiredFixes.length}`);
      }
    });
    lines.push('');
  }

  // Recent Sessions
  if (ctx.recentSessions.length > 0) {
    lines.push('### Recent Express Lane Sessions');
    lines.push('');
    ctx.recentSessions.forEach(s => {
      const lastActive = new Date(s.lastActivity).toLocaleDateString();
      lines.push(`- **${s.title}** (${s.messageCount} messages, last active ${lastActive})`);
    });
    lines.push('');
  }

  // Focus Areas
  if (ctx.focusAreas.length > 0) {
    lines.push('### Focus Areas');
    lines.push('');
    lines.push(ctx.focusAreas.map(a => `- ${a}`).join('\n'));
    lines.push('');
  }

  // Agent Roles Reminder
  lines.push('## Agent Roles');
  lines.push('');
  lines.push('- **Daniela** = Gemini-powered AI tutor (voice/text chat with students)');
  lines.push('- **Editor** = Claude-powered observer (beacon responses, analysis) - talks, can\'t build');
  lines.push('- **Wren** = Replit dev agent (builds features) - walks the walk');
  lines.push('- **Founder** = User (product direction)');
  lines.push('');
  lines.push('## Workflow Status');
  lines.push('App running on port 5000.');

  return lines.join('\n');
}

async function main() {
  console.log('🐦 Wren Session Startup');
  console.log('========================');
  console.log('');

  // Fetch Hive context
  console.log('📡 Fetching Hive context...');
  const ctx = await fetchHiveContext();
  
  if (!ctx) {
    console.log('⚠️  Could not fetch Hive context. Using manual memory only.');
    return;
  }

  console.log(`✅ Hive context loaded:`);
  console.log(`   - ${ctx.pendingBeacons.length} pending beacons`);
  console.log(`   - ${ctx.activeSprints.length} active sprints`);
  console.log(`   - ${ctx.recentSessions.length} recent sessions`);
  console.log(`   - System health: ${ctx.systemHealth.recentActivityLevel}`);
  console.log('');

  // Format and write memory file
  const content = formatHiveContext(ctx);
  
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const memoryDir = path.dirname(MEMORY_FILE);
  await fs.mkdir(memoryDir, { recursive: true });
  await fs.writeFile(MEMORY_FILE, content);
  
  console.log(`📝 Memory file updated: ${MEMORY_FILE}`);
  console.log('');
  console.log('🚀 Wren is ready with full Hive awareness!');
}

main().catch(console.error);
