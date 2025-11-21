import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

const USER_API_KEY = process.env.USER_OPENAI_API_KEY;

if (!USER_API_KEY) {
  console.error('❌ USER_OPENAI_API_KEY not found in environment');
  process.exit(1);
}

console.log('🔍 Testing OpenAI API Key');
console.log('📋 Key length:', USER_API_KEY.length, 'characters');
console.log('📋 Key prefix:', USER_API_KEY.substring(0, 10) + '...');
console.log('');

const client = new OpenAI({
  apiKey: USER_API_KEY,
});

async function testWhisper() {
  console.log('🎤 Test 1: Whisper (Speech-to-Text)');
  console.log('   Creating test audio file...');
  
  try {
    // Create a minimal valid WAV file (silence)
    const sampleRate = 16000;
    const duration = 1; // 1 second
    const numSamples = sampleRate * duration;
    const header = Buffer.alloc(44);
    
    // WAV header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + numSamples * 2, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // Mono
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(numSamples * 2, 40);
    
    const audioData = Buffer.alloc(numSamples * 2);
    const testFile = Buffer.concat([header, audioData]);
    
    const tempPath = path.join('/tmp', 'test-audio.wav');
    fs.writeFileSync(tempPath, testFile);
    
    console.log('   Sending to Whisper API...');
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
    });
    
    console.log('   ✅ Whisper API WORKING');
    console.log('   Response:', transcription.text || '(empty transcription for silent audio)');
    
    fs.unlinkSync(tempPath);
    return true;
  } catch (error: any) {
    console.log('   ❌ Whisper API FAILED');
    console.log('   Error:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function testTTS() {
  console.log('');
  console.log('🔊 Test 2: TTS (Text-to-Speech)');
  console.log('   Sending to TTS API...');
  
  try {
    const mp3 = await client.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: 'Testing',
    });
    
    const buffer = Buffer.from(await mp3.arrayBuffer());
    console.log('   ✅ TTS API WORKING');
    console.log('   Response size:', buffer.length, 'bytes');
    return true;
  } catch (error: any) {
    console.log('   ❌ TTS API FAILED');
    console.log('   Error:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function testChatCompletion() {
  console.log('');
  console.log('💬 Test 3: Chat Completion (Verify Key Works)');
  console.log('   Sending to Chat API...');
  
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "test"' }],
      max_tokens: 10,
    });
    
    console.log('   ✅ Chat API WORKING');
    console.log('   Response:', completion.choices[0]?.message?.content);
    return true;
  } catch (error: any) {
    console.log('   ❌ Chat API FAILED');
    console.log('   Error:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function main() {
  const whisperWorks = await testWhisper();
  const ttsWorks = await testTTS();
  const chatWorks = await testChatCompletion();
  
  console.log('');
  console.log('📊 Summary:');
  console.log('   Whisper (STT):', whisperWorks ? '✅ Working' : '❌ Failed');
  console.log('   TTS:', ttsWorks ? '✅ Working' : '❌ Failed');
  console.log('   Chat:', chatWorks ? '✅ Working' : '❌ Failed');
  console.log('');
  
  if (whisperWorks && ttsWorks && chatWorks) {
    console.log('🎉 All tests passed! Your API key is valid.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
