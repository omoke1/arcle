/**
 * List Available Gemini Models
 * 
 * Check what models your API key can access
 * Usage: npx tsx scripts/list-gemini-models.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function listModels() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    console.log('❌ GOOGLE_AI_API_KEY not found');
    return;
  }

  console.log('🔍 Checking available Gemini models...\n');
  console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}\n`);

  try {
    // Try v1 API
    console.log('Trying v1 API...');
    const responseV1 = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    
    if (responseV1.ok) {
      const data = await responseV1.json();
      console.log('\n✅ v1 API Models Available:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const error = await responseV1.text();
      console.log(`\n❌ v1 API Failed (${responseV1.status}):`);
      console.log(error);
    }

    // Try v1beta API
    console.log('\n\nTrying v1beta API...');
    const responseV1Beta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    if (responseV1Beta.ok) {
      const data = await responseV1Beta.json();
      console.log('\n✅ v1beta API Models Available:');
      
      if (data.models && Array.isArray(data.models)) {
        console.log(`\nFound ${data.models.length} models:\n`);
        data.models.forEach((model: any) => {
          console.log(`📦 ${model.name}`);
          if (model.supportedGenerationMethods) {
            console.log(`   Methods: ${model.supportedGenerationMethods.join(', ')}`);
          }
          console.log('');
        });
      } else {
        console.log(JSON.stringify(data, null, 2));
      }
    } else {
      const error = await responseV1Beta.text();
      console.log(`\n❌ v1beta API Failed (${responseV1Beta.status}):`);
      console.log(error);
    }

  } catch (error: any) {
    console.log('\n❌ Connection Error:', error.message);
  }
}

listModels().catch(console.error);














