#!/usr/bin/env tsx
/**
 * Direct test of Realtime API access
 * This will help us see the exact error from OpenAI
 */

const apiKey = process.env.USER_OPENAI_API_KEY;

console.log('\n🔍 Testing Realtime API Access\n');
console.log('API Key exists:', !!apiKey);
console.log('API Key prefix:', apiKey?.substring(0, 10) + '...');
console.log('\nTesting model: gpt-4o-mini-realtime-preview-2025-09-25\n');

async function testRealtimeAccess() {
  const testUrl = 'https://api.openai.com/v1/realtime/sessions';
  
  try {
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-realtime-preview-2025-09-25',
        voice: 'alloy',
      }),
    });

    console.log('HTTP Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('');

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.log('Response (not JSON):', responseText);
      return;
    }

    console.log('Response Data:');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ SUCCESS! Realtime API access confirmed!');
      console.log('Session ID:', data.id);
    } else {
      console.log('\n❌ FAILED! Error details:');
      console.log('Error Type:', data.error?.type);
      console.log('Error Message:', data.error?.message);
      console.log('Error Code:', data.error?.code);
    }

  } catch (error: any) {
    console.error('❌ Network/Request Error:', error.message);
  }
}

testRealtimeAccess();
