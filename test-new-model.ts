async function testModel(modelName: string, apiKey: string) {
  console.log(`\n🔍 Testing: ${modelName}`);
  
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

    if (response.status === 200) {
      console.log(`✅ SUCCESS! Session ID: ${data.id}`);
      console.log(`   Model: ${data.model}`);
      return true;
    } else {
      console.log(`❌ FAILED: ${response.status}`);
      console.log(`   Error: ${data.error?.message || JSON.stringify(data)}`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ EXCEPTION: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🎯 Testing Latest OpenAI Realtime Models\n');
  
  const apiKey = process.env.USER_OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ USER_OPENAI_API_KEY not found!');
    process.exit(1);
  }

  console.log('Testing models released in 2025...\n');

  // Test new GA model (August 2025)
  const gaSuccess = await testModel('gpt-realtime', apiKey);

  // Test current models we're using
  const miniSuccess = await testModel('gpt-4o-mini-realtime-preview-2025-09-25', apiKey);
  const proSuccess = await testModel('gpt-4o-realtime-preview-2024-12-17', apiKey);

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTS');
  console.log('='.repeat(60));
  console.log(`\n🆕 gpt-realtime (GA, Aug 2025):        ${gaSuccess ? '✅ AVAILABLE' : '❌ NOT AVAILABLE'}`);
  console.log(`📦 gpt-4o-mini (Sept 2025 preview):    ${miniSuccess ? '✅ AVAILABLE' : '❌ NOT AVAILABLE'}`);
  console.log(`💎 gpt-4o (Dec 2024 preview):          ${proSuccess ? '✅ AVAILABLE' : '❌ NOT AVAILABLE'}`);

  if (gaSuccess) {
    console.log('\n💡 RECOMMENDATION: Upgrade to gpt-realtime (30% better, 20% cheaper!)');
  }
}

main();
