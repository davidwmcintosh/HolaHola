async function testRealtimeModel(modelName: string, apiKey: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Testing Model: ${modelName}`);
  console.log(`${'='.repeat(60)}\n`);

  console.log(`API Key prefix: ${apiKey.substring(0, 12)}...`);
  console.log(`API Key length: ${apiKey.length} characters\n`);

  try {
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        voice: 'alloy',
      }),
    });

    const data = await response.json();

    console.log(`HTTP Status: ${response.status}`);
    console.log(`Status Text: ${response.statusText}\n`);

    if (response.status === 200) {
      console.log('✅ SUCCESS! Model is accessible!');
      console.log(`Session ID: ${data.id}`);
      console.log(`Model Confirmed: ${data.model}`);
      console.log(`Voice: ${data.voice}`);
      console.log(`Modalities: ${data.modalities.join(', ')}`);
      return true;
    } else {
      console.log('❌ FAILED! Error details:');
      console.log('Response Data:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error: any) {
    console.log('❌ EXCEPTION occurred:');
    console.log(error.message);
    return false;
  }
}

async function main() {
  console.log('\n🎯 LINGUAFLOW MODEL VERIFICATION TEST');
  console.log('Testing both tier models with USER_OPENAI_API_KEY\n');

  const apiKey = process.env.USER_OPENAI_API_KEY;
  
  if (!apiKey) {
    console.log('❌ USER_OPENAI_API_KEY environment variable not found!');
    process.exit(1);
  }

  console.log(`Using API Key: ${apiKey.substring(0, 12)}... (${apiKey.length} chars)`);

  // Test Free/Basic/Institutional tier model
  const miniSuccess = await testRealtimeModel(
    'gpt-4o-mini-realtime-preview-2025-09-25',
    apiKey
  );

  // Test Pro tier model
  const proSuccess = await testRealtimeModel(
    'gpt-4o-realtime-preview-2024-12-17',
    apiKey
  );

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  console.log(`Free/Basic/Institutional (gpt-4o-mini): ${miniSuccess ? '✅ READY' : '❌ FAILED'}`);
  console.log(`Pro (gpt-4o): ${proSuccess ? '✅ READY' : '❌ FAILED'}`);
  console.log('');

  if (miniSuccess && proSuccess) {
    console.log('🎉 All models verified! Voice chat is ready for all tiers!');
  } else {
    console.log('⚠️  Some models failed verification. Check errors above.');
  }
}

main();
