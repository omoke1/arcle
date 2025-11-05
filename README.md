# ARCLE

AI-powered blockchain wallet built on Circle's Arc blockchain.

## Overview

ARCLE is a chat-first crypto wallet where users interact with blockchain through natural language conversation. The AI translates human intent into blockchain transactions.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Blockchain**: Circle Programmable Wallets, Arc Network
- **Web3**: Viem, Ethers.js

## Getting Started

### Prerequisites

- Node.js 16.x
- npm 8+ or yarn
- Circle Developer account
- Arc testnet access

### Installation

1. Clone the repository
```bash
git clone <repo-url>
cd arcle
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```

Fill in your Circle API keys and Arc RPC URL in `.env`

4. Run development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
arcle/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── ...               # Custom components
├── lib/                  # Utilities and helpers
├── hooks/                # Custom React hooks
├── types/                # TypeScript types
└── public/              # Static assets
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - TypeScript type checking

## Brand Colors

See `.cursor/branding-guide.md` for full brand guidelines.

- **Rich Blue**: `#012AFE` - Primary brand color
- **Onyx**: `#111111` - Primary text & dark elements
- **Dark Grey**: `#353535` - Secondary backgrounds
- **Casper**: `#ABBBCB` - Light accents

## Documentation

- [MVP Plan](./.cursor/mvp-plan.md)
- [UI Plans](./.cursor/ui-plans.md)
- [Brand Guide](./.cursor/branding-guide.md)
- [Project Scratchpad](./.cursor/scratchpad.md)

## License

MIT

