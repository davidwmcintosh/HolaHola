/**
 * MINIMAL OpenAI Realtime API Test
 * This tests the absolute bare minimum to see where the issue is
 * Run with: npx tsx test-realtime-minimal.ts
 */

import WebSocket from 'ws';

// Try multiple API key sources
const OPENAI_API_KEY = 
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY || 
  process.env.OPENAI_API_KEY || 
  process.env.USER_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ No OpenAI API key found');
  process.exit(1);
}

console.log('🔑 API Key found:', OPENAI_API_KEY.substring(0, 10) + '...');
console.log('🔑 Key source:', process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? 'AI_INTEGRATIONS' : 'OPENAI_API_KEY');

async function testMinimalRealtime() {
  console.log('\n=== STEP 1: Creating ephemeral session via REST ===');
  
  try {
    // Create ephemeral session
    const sessionResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy'
      })
    });

    if (!sessionResponse.ok) {
      const error = await sessionResponse.text();
      console.error('❌ Session creation failed:', sessionResponse.status, error);
      return;
    }

    const sessionData = await sessionResponse.json();
    console.log('✅ Session created:', sessionData.id);

    const ephemeralKey = sessionData.client_secret.value;

    console.log('\n=== STEP 2: Connecting to WebSocket ===');

    const ws = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
      {
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );

    ws.on('open', () => {
      console.log('✅ WebSocket connected');
    });

    ws.on('message', (data: Buffer) => {
      const event = JSON.parse(data.toString());
      console.log('\n📨 Received:', event.type);

      if (event.type === 'session.created') {
        console.log('✅ Session created event received');
        console.log('Session config:', JSON.stringify(event.session, null, 2));
        
        console.log('\n=== STEP 3: Sending MINIMAL session.update ===');
        
        // TEST 1: Absolutely minimal - JUST instructions
        const minimalConfig = {
          type: 'session.update',
          session: {
            instructions: 'You are a helpful assistant.'
          }
        };
        
        console.log('Sending config:', JSON.stringify(minimalConfig, null, 2));
        ws.send(JSON.stringify(minimalConfig));
      }

      if (event.type === 'session.updated') {
        console.log('✅ Session updated successfully!');
        console.log('Updated config:', JSON.stringify(event.session, null, 2));
        console.log('\n🎉 SUCCESS! Minimal config works!');
        
        // Close after success
        setTimeout(() => {
          console.log('\nClosing connection...');
          ws.close();
          process.exit(0);
        }, 1000);
      }

      if (event.type === 'error') {
        console.error('\n❌ ERROR EVENT:', JSON.stringify(event, null, 2));
        ws.close();
        process.exit(1);
      }
    });

    ws.on('error', (error) => {
      console.error('\n❌ WebSocket error:', error.message);
    });

    ws.on('close', (code, reason) => {
      console.log(`\n🔌 Connection closed: ${code} ${reason}`);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      console.log('\n⏱️ Test timeout - closing');
      ws.close();
      process.exit(1);
    }, 10000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

console.log('🧪 Starting minimal Realtime API test...\n');
testMinimalRealtime();
