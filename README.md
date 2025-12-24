# 🎙️ V64 — G-One : Design and Development of an AI Assistant with Advanced UI/UX and   Multi-Agent Model Architecture

> **A next-generation AI-powered voice assistant with advanced RAG, multi-LLM support, and intelligent conversation management.**

## 📌 Table of Contents

1. [Overview](#-overview)
2. [Key Features](#-key-features)
3. [System Architecture](#-system-architecture)
4. [Technology Stack](#-technology-stack)
5. [Database Design](#-database-design)
6. [AI & LLM Architecture](#-ai--llm-architecture)
7. [RAG (Retrieval Augmented Generation)](#-rag-retrieval-augmented-generation)
8. [Authentication & Authorization](#-authentication--authorization)
9. [API Documentation](#-api-documentation)
10. [Installation & Setup](#-installation--setup)
11. [Environment Variables](#-environment-variables)
12. [Usage Guide](#-usage-guide)
13. [Project Structure](#-project-structure)
14. [Performance & Optimization](#-performance--optimization)
15. [Deployment](#-deployment)
16. [Testing](#-testing)
17. [Contributing](#-contributing)
18. [License](#-license)
19. [Roadmap](#-roadmap)

---

## 🌟 Overview

**V64** is a scalable AI Voice Assistant platform built using **Next.js 15**, enabling:

* 🎤 Real-time voice conversations
* 🧠 Intelligent multi-LLM reasoning
* 📚 RAG-powered knowledge augmentation
* 🔐 Secure authentication & subscriptions
* ⚡ High-performance, production-ready APIs

---

## ✨ Key Features

### 🎯 Core Capabilities

* **Speech-to-Text & Text-to-Speech**
* **Multi-Provider LLM Routing with Fallback**
* **Context-Aware Conversations**
* **Chain-of-Thought (CoT) Reasoning**
* **Semantic Search using Pinecone**
* **Subscription-based Usage Limits**
* **3D Interactive UI (Three.js)**

---

## 🏗️ System Architecture

### High-Level Architecture

```
Client (Browser)
 ├─ Voice Input (Web Speech API)
 ├─ 3D UI (React Three Fiber)
 └─ Dashboard (Next.js)

API Layer (Next.js)
 ├─ Voice Assistant API
 ├─ Auth API (NextAuth)
 ├─ User API
 └─ Payments API

AI Layer
 ├─ Ollama (Local)
 ├─ OpenAI
 ├─ Gemini
 ├─ Hugging Face
 └─ Pinecone (Vector DB)

Database
 └─ MongoDB Atlas
```

---

## 🛠️ Technology Stack

### Frontend

* Next.js 15 (App Router)
* React 19
* Tailwind CSS
* Radix UI + shadcn/ui
* Framer Motion
* React Three Fiber

### Backend

* Node.js (Next.js API Routes)
* MongoDB + Mongoose
* NextAuth.js
* Stripe
* Axios

### AI & ML

* Ollama (Local LLM)
* OpenAI GPT-4o-mini
* Google Gemini
* Hugging Face (Mistral + Embeddings)
* Pinecone Vector Database

---

## 🗄️ Database Design

### Users Collection

```ts
{
  name: string
  email: string (unique)
  password?: string
  plan: "Free" | "Pro" | "Enterprise"
  chatsUsed: number
  chatsLimit: number
  googleId?: string
  createdAt: Date
}
```

### Sessions & Accounts (NextAuth)

* JWT-based stateless sessions
* OAuth + Credentials support

---

## 🤖 AI & LLM Architecture

### Provider Priority

1. **Ollama (Local)** — `llama3.2:3b`
2. **OpenAI** — `gpt-4o-mini`
3. **Hugging Face** — `Mistral-7B`
4. **Google Gemini** — `gemini-2.0-flash-exp`

### Automatic Fallback Logic

```ts
Ollama → OpenAI → Hugging Face → Gemini
```

---

## 📚 RAG (Retrieval Augmented Generation)

### Knowledge Sources

* Pinecone Vector Store
* Wikipedia API
* JSON Knowledge Base
* Medical Knowledge Module

### Embeddings

* `sentence-transformers/all-MiniLM-L6-v2`
* 384-dimensional vectors
* Local fallback embedding system

---

## 🔐 Authentication & Authorization

* Google OAuth 2.0
* Email/Password (bcrypt)
* JWT Sessions
* Role-based plan limits
* Secure cookies + CSRF protection

---

## 🔌 API Documentation

### Voice Assistant

**POST** `/api/voice-assistant`

```json
{
  "message": "Explain AI",
  "sessionId": "abc123"
}
```

**Response Includes**

* Generated answer
* Provider metadata
* RAG results
* Token usage
* Confidence score

---

## 📦 Installation & Setup

### Prerequisites

* Node.js 18+
* MongoDB Atlas
* (Optional) Ollama

### Steps

```bash
git clone https://github.com/yourusername/v64-voice-assistant
cd v64-voice-assistant
npm install
npm run dev
```

---

## ⚙️ Environment Variables

```env
MONGODB_URI=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

OLLAMA_URL=http://localhost:11434
OPENAI_API_KEY=
GEMINI_API_KEY=
HUGGINGFACE_API_KEY=

PINECONE_API_KEY=
STRIPE_SECRET_KEY=
```

---

## 🚀 Usage Guide

1. Click 🎤 microphone
2. Speak your query
3. AI processes via RAG + LLM
4. Hear spoken response

Supports **multi-turn context**, **reasoning**, and **knowledge queries**.

---

## 📁 Project Structure

```
app/
 ├─ api/
 ├─ auth/
 ├─ profile/
 └─ page.tsx

components/
 ├─ VoiceAssistant/
 ├─ 3d/
 └─ ui/

models/
lib/
data/
```
---

## ⚡ Performance & Optimization

* Dynamic imports
* In-memory caching
* Indexed DB queries
* Rate limiting
* Lighthouse score: **90+**

---

## 🐳 Deployment

### Docker

```bash
docker build -t v64 .
docker run -p 3000:3000 v64
```
---

## 🧪 Testing

```bash
npm run test
npm run e2e
```

---

## 🤝 Contributing

1. Jagananmol Daneti
2. Bhaskar Sanam
3. Aviraj Yadav

---

## 📄 License

MIT License © V64 Team
