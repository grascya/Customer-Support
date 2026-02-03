# 🏠 Lumino AI Customer Support Chatbot

> **Production-ready RAG-powered chatbot that achieves 86.7% accuracy on evaluation tests**

An intelligent customer support assistant for Lumino Smart Home Hub built with Next.js, Claude 3.5 Sonnet, and Supabase. Uses Retrieval-Augmented Generation (RAG) to provide accurate, context-aware responses from product documentation.

[![Grade: B](https://img.shields.io/badge/Grade-B-success)](./evaluations)
[![Pass Rate: 86.7%](https://img.shields.io/badge/Pass%20Rate-86.7%25-success)](./evaluations)
[![Retrieval: 100%](https://img.shields.io/badge/Retrieval-100%25-brightgreen)](./evaluations)
[![Response Time: <2s](https://img.shields.io/badge/Response%20Time-%3C2s-blue)](./evaluations)

![Lumino Chat Demo](https://via.placeholder.com/800x400/FF6B35/FFFFFF?text=Lumino+Chat+Widget)

---

## ✨ Features

- **🎯 RAG-Powered Responses** - Grounds answers in actual product documentation to prevent hallucinations
- **⚡ Real-Time Streaming** - Word-by-word response streaming for better UX
- **👍 Feedback System** - Thumbs up/down collection for continuous improvement
- **📊 Admin Dashboard** - Real-time analytics, sentiment tracking, and conversation monitoring
- **🔄 Smart Escalation** - Automatically detects frustrated users and escalates to human agents
- **💬 Session Management** - Maintains conversation context across page refreshes
- **📱 Responsive Design** - Works seamlessly on desktop and mobile

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- OpenRouter API key
- OpenAI API key (for embeddings)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/lumino-chatbot.git
cd lumino-chatbot

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Environment Variables

```bash


### Database Setup

```bash
# 1. Create a Supabase project
# 2. Run the schema in Supabase SQL Editor
cat supabase-schema.sql | pbcopy  # Copy to clipboard
# 3. Paste and execute in Supabase SQL Editor
```

### Seed Knowledge Base

```bash
# Populate the database with documentation
npx tsx --env-file=.env scripts/seed-knowledge-base.ts
```

### Run Development Server

```bash
npm run dev
# Open http://localhost:3000
```

---

## 📁 Project Structure

```
├── app/
│   ├── api/
│   │   ├── chat-stream/        # Main chat endpoint
│   │   ├── feedback/           # Feedback collection
│   │   └── admin/              # Admin dashboard API
│   ├── components/
│   │   └── LuminoChat.tsx      # Chat widget UI
│   └── admin/
│       └── page.tsx            # Admin dashboard
├── lib/
│   ├── utils/
│   │   ├── rag.ts              # RAG implementation
│   │   ├── sentiment.ts        # Sentiment analysis
│   │   └── escalation.ts       # Smart escalation
│   ├── constants/
│   │   └── prompts.ts          # System prompts
│   └── supabase/
│       └── server.ts           # Supabase client
├── docs/
│   ├── technical-setup.txt     # Voice commands, integrations
│   ├── hardware-specs.txt      # Processor, temperature limits
│   ├── sentinel-plus.txt       # Subscription pricing
│   └── troubleshooting.txt     # Support, warranty
├── evaluations/
│   ├── test-cases.ts           # 15 test questions
│   ├── metrics.ts              # Scoring functions
│   └── run-evaluations.ts      # Evaluation runner
└── scripts/
    └── seed-knowledge-base.ts  # Populate knowledge base
```

---

## 🎯 How It Works

### RAG Pipeline

```
User Question
     ↓
[Generate Embedding]
     ↓
[Vector Search in Knowledge Base]
     ↓
[Retrieve Top 5 Documents]
     ↓
[Format Context for LLM]
     ↓
[Claude 3.5 Sonnet generates answer]
     ↓
[Stream Response to User]
```

### Technical Details

- **Embeddings**: OpenAI `text-embedding-3-small` (1536 dimensions)
- **Vector DB**: Supabase with `pgvector` extension
- **LLM**: Claude 3.5 Sonnet via OpenRouter
- **Similarity**: Cosine similarity with 0.3 threshold
- **Retrieval**: Top 5 most relevant document chunks

---

## 📊 Evaluation Results

```
🎓 Grade: B (83.5/100)
✅ Pass Rate: 13/15 (86.7%)
🔍 Retrieval Accuracy: 100%
📈 Average Quality: 83.5/100
⚡ Response Time: <2s average
```

### Test Coverage

- **Easy (4)**: Direct facts - 100% pass rate
- **Medium (6)**: Multi-document queries - 83.3% pass rate
- **Hard (3)**: Complex synthesis - 66.7% pass rate
- **Edge Cases (2)**: Off-topic, ambiguous - 100% pass rate

Run evaluations:
```bash
npx tsx --env-file=.env evaluations/run-evaluations.ts
```

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Frontend** | React 18, TypeScript, Tailwind CSS |
| **Animations** | Framer Motion |
| **Database** | Supabase (PostgreSQL + pgvector) |
| **AI/LLM** | Claude 3.5 Sonnet (OpenRouter) |
| **Embeddings** | OpenAI text-embedding-3-small |
| **Deployment** | Vercel |

---

## 💰 Cost Analysis

Per 1,000 conversations:
- **Embeddings**: $0.03
- **LLM**: $7.50
- **Database**: $0.83
- **Total**: ~$8.36

**vs. Human Support**: ~$15,000 (99.9% cost savings)

---

## 🎨 Features in Detail

### 1. Real-Time Streaming

Responses stream word-by-word like ChatGPT using Server-Sent Events (SSE).

```typescript
// Frontend receives chunks and displays incrementally
const reader = response.body?.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  displayChunk(value);
}
```

### 2. Feedback System

Users can rate responses with thumbs up/down. Feedback is stored in the database for analytics.

```typescript
// Click thumbs up → Button turns green → "Thanks for feedback!"
// Data saved to message_feedback table
```

### 3. Sentiment Analysis

Every user message is analyzed for sentiment (positive/neutral/negative) using Claude 3.5 Haiku.

```typescript
const sentiment = await analyzeSentiment(message);
// Used for escalation and analytics
```

### 4. Smart Escalation

Automatically escalates to human agents when:
- User explicitly requests ("speak to a human")
- Multiple negative sentiment messages detected
- User asks same question 3+ times
- Bot unable to find relevant information

### 5. Admin Dashboard

Monitor chatbot performance at `/admin`:
- Total conversations and active chats
- Sentiment distribution chart
- Feedback statistics (satisfaction rate)
- Recent conversations table
- Escalated conversations

---

## 📚 API Endpoints

### Chat Stream
```
POST /api/chat-stream
Body: { message: string, sessionId: string }
Returns: Server-Sent Events stream
```

### Feedback
```
POST /api/feedback
Body: { messageId: string, rating: 1 | -1 }
Returns: { success: boolean }
```

### Admin Dashboard
```
GET /api/admin/dashboard
Returns: { stats, conversations }
```

---

## 🧪 Testing

```bash
# Run full evaluation suite
npx tsx --env-file=.env evaluations/run-evaluations.ts

# Test specific features
npm run test  # (if tests added)

# Check database seeding
npx tsx --env-file=.env scripts/seed-knowledge-base.ts
```

---

## 🚀 Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy --prod

# Set environment variables in Vercel dashboard
```

### Database Setup

1. Create Supabase project
2. Run `supabase-schema.sql` in SQL Editor
3. Seed knowledge base
4. Update environment variables

---

## 🔧 Configuration

### Adjust RAG Parameters

Edit `lib/utils/rag.ts`:

```typescript
// Similarity threshold (0.0 - 1.0)
const threshold = 0.3;  // Lower = more results

// Number of documents to retrieve
const limit = 5;

// Chunk size for documents
const chunkSize = 800;
```

### Customize Prompts

Edit `lib/constants/prompts.ts`:

```typescript
export const SYSTEM_PROMPT = `
  You are the Lumino Technical Assistant...
`;
```

### Update Knowledge Base

1. Add/edit `.txt` files in `/docs` folder
2. Re-run seed script:
```bash
npx tsx --env-file=.env scripts/seed-knowledge-base.ts
```

---

## 📈 Roadmap

### Short-Term
- [ ] Conversation memory (include chat history in context)
- [ ] Show sources in responses
- [ ] Mobile app optimization

### Medium-Term
- [ ] Multi-language support (Spanish, French)
- [ ] Voice interface (speech-to-text)
- [ ] Rich responses (markdown, images)

### Long-Term
- [ ] Multi-tenant SaaS (custom knowledge bases)
- [ ] Agent handoff to Zendesk/Intercom
- [ ] A/B testing framework

---

## 🤝 Contributing

Contributions welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) for Claude 3.5 Sonnet
- [OpenRouter](https://openrouter.ai) for unified LLM API access
- [Supabase](https://supabase.com) for database and vector search
- [Vercel](https://vercel.com) for seamless deployment

---


## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/yourusername/lumino-chatbot?style=social)
![GitHub forks](https://img.shields.io/github/forks/yourusername/lumino-chatbot?style=social)
![GitHub issues](https://img.shields.io/github/issues/yourusername/lumino-chatbot)
![GitHub license](https://img.shields.io/github/license/yourusername/lumino-chatbot)

---

<div align="center">
  <strong>Built with ❤️ for better customer support</strong>
</div>