# Environment Variables Setup

## Required for Production (Vercel)

### Circle API (Required)
```bash
CIRCLE_API_KEY=TEST_API_KEY:key_id:key_secret
CIRCLE_ENTITY_SECRET=your_entity_secret_here
NEXT_PUBLIC_ENV=sandbox
```

### AI Service (Optional but Recommended)
```bash
# Google AI (Gemini) - Priority 1
GOOGLE_AI_API_KEY=AIzaSyAulRKIIhUUy-11mJqbJSbMxpGcXqTPN2M

# OpenRouter (Fallback) - Priority 2
OPENROUTER_API_KEY=your_openrouter_key_here
AI_MODEL=meta-llama/Meta-Llama-3.1-70B-Instruct
```

## AI Service Priority Order

1. **Google AI (Gemini)** - If `GOOGLE_AI_API_KEY` is set
2. **OpenRouter** - If `OPENROUTER_API_KEY` is set (fallback)
3. **Rule-based AI** - Always available as final fallback

## Local Development (.env.local)

Create a `.env.local` file in the project root with the above variables.

## Vercel Setup

1. Go to your project in Vercel Dashboard
2. Navigate to Settings → Environment Variables
3. Add all required variables
4. Redeploy your application

---

**Note**: The Google AI API key provided is active and will be used for AI chat responses.

