import { db } from '../server/db';
import { conversations, messages, voiceSessions } from '../shared/schema';
import { eq, inArray } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCSV(content: string): any[] {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const row: any = {};
    
    headers.forEach((header, idx) => {
      let value = values[idx] || '';
      value = value.replace(/^""|""$/g, '').replace(/^"|"$/g, '');
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      if (value === '' || value === 'null') {
        row[header] = null;
      } else if (value === 'true') {
        row[header] = true;
      } else if (value === 'false') {
        row[header] = false;
      } else if (/^\d+$/.test(value)) {
        row[header] = parseInt(value, 10);
      } else {
        row[header] = value;
      }
    });
    
    rows.push(row);
  }
  
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

async function importConversations(rows: any[]): Promise<{ imported: number; skipped: number }> {
  const ids = rows.map(r => r.id);
  const existing = await db.select({ id: conversations.id }).from(conversations).where(inArray(conversations.id, ids));
  const existingIds = new Set(existing.map(e => e.id));
  
  const newRows = rows.filter(r => !existingIds.has(r.id));
  console.log(`Conversations: ${newRows.length} new, ${rows.length - newRows.length} already exist`);
  
  for (const row of newRows) {
    try {
      await db.insert(conversations).values({
        id: row.id,
        userId: row.user_id,
        language: row.language,
        nativeLanguage: row.native_language,
        difficulty: row.difficulty,
        topic: row.topic || null,
        title: row.title || null,
        messageCount: row.message_count || 0,
        duration: row.duration || 0,
        isOnboarding: row.is_onboarding || false,
        onboardingStep: row.onboarding_step || null,
        userName: row.user_name || null,
        successfulMessages: row.successful_messages || 0,
        totalAssessedMessages: row.total_assessed_messages || 0,
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        actflLevel: row.actfl_level || null,
        isStarred: row.is_starred || false,
        classId: row.class_id || null,
        learningContext: row.learning_context || 'self_directed',
        conversationType: row.conversation_type || 'learning',
        ownerEmail: row.owner_email || null,
      });
    } catch (err: any) {
      console.error(`Failed to insert conversation ${row.id}:`, err.message);
    }
  }
  
  return { imported: newRows.length, skipped: rows.length - newRows.length };
}

async function importMessages(rows: any[]): Promise<{ imported: number; skipped: number }> {
  const ids = rows.map(r => r.id);
  
  const batchSize = 500;
  const existingIds = new Set<string>();
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const existing = await db.select({ id: messages.id }).from(messages).where(inArray(messages.id, batch));
    existing.forEach(e => existingIds.add(e.id));
  }
  
  const newRows = rows.filter(r => !existingIds.has(r.id));
  console.log(`Messages: ${newRows.length} new, ${rows.length - newRows.length} already exist`);
  
  let imported = 0;
  for (const row of newRows) {
    try {
      await db.insert(messages).values({
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        content: row.content,
        performanceScore: row.performance_score || null,
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        targetLanguageText: row.target_language_text || null,
        mediaJson: row.media_json || null,
        enrichmentStatus: row.enrichment_status || null,
        actflLevel: row.actfl_level || null,
        wordTimingsJson: row.word_timings_json || null,
        subtitlesJson: row.subtitles_json || null,
      });
      imported++;
    } catch (err: any) {
      if (!err.message.includes('duplicate key') && !err.message.includes('violates foreign key')) {
        console.error(`Failed to insert message ${row.id}:`, err.message);
      }
    }
  }
  
  return { imported, skipped: rows.length - imported };
}

async function importVoiceSessions(rows: any[]): Promise<{ imported: number; skipped: number }> {
  const ids = rows.map(r => r.id);
  const existing = await db.select({ id: voiceSessions.id }).from(voiceSessions).where(inArray(voiceSessions.id, ids));
  const existingIds = new Set(existing.map(e => e.id));
  
  const newRows = rows.filter(r => !existingIds.has(r.id));
  console.log(`Voice Sessions: ${newRows.length} new, ${rows.length - newRows.length} already exist`);
  
  let imported = 0;
  for (const row of newRows) {
    try {
      await db.insert(voiceSessions).values({
        id: row.id,
        userId: row.user_id,
        conversationId: row.conversation_id || null,
        startedAt: row.started_at ? new Date(row.started_at) : new Date(),
        endedAt: row.ended_at ? new Date(row.ended_at) : null,
        durationSeconds: row.duration_seconds || 0,
        exchangeCount: row.exchange_count || 0,
        studentSpeakingSeconds: row.student_speaking_seconds || 0,
        tutorSpeakingSeconds: row.tutor_speaking_seconds || 0,
        ttsCharacters: row.tts_characters || 0,
        sttSeconds: row.stt_seconds || 0,
        language: row.language || 'spanish',
        status: row.status || 'completed',
        classId: row.class_id || null,
        isTestSession: row.is_test_session || false,
        tutorMode: row.tutor_mode || 'main',
      });
      imported++;
    } catch (err: any) {
      if (!err.message.includes('duplicate key') && !err.message.includes('violates foreign key')) {
        console.error(`Failed to insert voice session ${row.id}:`, err.message);
      }
    }
  }
  
  return { imported, skipped: rows.length - imported };
}

async function main() {
  console.log('Starting production data import...\n');
  
  const conversationsPath = path.join(__dirname, '../attached_assets/conversations_1769535234378.csv');
  const messagesPath = path.join(__dirname, '../attached_assets/messages_1769535234410.csv');
  const voiceSessionsPath = path.join(__dirname, '../attached_assets/voice_sessions_1769535234411.csv');
  
  console.log('1. Importing conversations...');
  const conversationsData = fs.readFileSync(conversationsPath, 'utf-8');
  const conversationsRows = parseCSV(conversationsData);
  const convResult = await importConversations(conversationsRows);
  console.log(`   Imported: ${convResult.imported}, Skipped: ${convResult.skipped}\n`);
  
  console.log('2. Importing voice sessions...');
  const voiceSessionsData = fs.readFileSync(voiceSessionsPath, 'utf-8');
  const voiceSessionsRows = parseCSV(voiceSessionsData);
  const vsResult = await importVoiceSessions(voiceSessionsRows);
  console.log(`   Imported: ${vsResult.imported}, Skipped: ${vsResult.skipped}\n`);
  
  console.log('3. Importing messages...');
  const messagesData = fs.readFileSync(messagesPath, 'utf-8');
  const messagesRows = parseCSV(messagesData);
  const msgResult = await importMessages(messagesRows);
  console.log(`   Imported: ${msgResult.imported}, Skipped: ${msgResult.skipped}\n`);
  
  console.log('=== Import Complete ===');
  console.log(`Conversations: ${convResult.imported} new`);
  console.log(`Voice Sessions: ${vsResult.imported} new`);
  console.log(`Messages: ${msgResult.imported} new`);
  
  process.exit(0);
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
