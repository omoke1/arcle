# ARCLE - UI Design Plans

## Design Philosophy

**Chat-First Interface**: The AI is the interface. Users interact through natural conversation, not complex UIs. The interface should feel conversational, not transactional.

**Key Principles**:
1. Chat-first: 90% of interaction is conversation
2. Minimal chrome: Hide navigation when not needed
3. Contextual information: Show balance, status when relevant
4. Trustworthy: Clear security indicators
5. Beautiful: Modern, polished, professional design
6. Fast: Instant feedback, smooth animations
7. Accessible: Readable, clear CTAs, voice input support

---

## Mobile UI Design

### Main Screen: Chat Interface (Primary View)

```
┌─────────────────────────────────────┐
│  ARCLE                     [Balance]│ ← Collapsible header
├─────────────────────────────────────┤
│                                     │
│  [AI Avatar] Hello! I'm your AI    │
│              wallet assistant.      │
│              How can I help?        │
│                                     │
│              [You] Send Jake $50    │
│                                     │
│  [AI Avatar] Found Jake in your    │
│              contacts (0x123...).   │
│              Ready to send $50?     │
│                                     │
│              [Preview Card]         │
│              Send $50 USDC          │
│              To: Jake (0x123...)   │
│              Fee: ~$0.01 USDC      │
│              [Confirm] [Cancel]     │
│                                     │
│  [You] Yes                          │
│                                     │
│  [AI Avatar] ✅ Sent! Transaction   │
│              confirmed in 2.3s.     │
│              [View Receipt]         │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  [Message input with mic icon]      │ ← Always visible
└─────────────────────────────────────┘
```

### Key Mobile Features:

- **Chat-first layout**: 90% of screen is conversation
- **Collapsible header**: Shows balance, expandable for details
- **Floating input**: Always accessible at bottom
- **AI avatar**: Distinct, friendly visual identity
- **Message bubbles**: Rounded, modern (User: right, AI: left)
- **Preview cards**: Transaction previews inline, expandable
- **Voice input**: Mic icon for voice commands
- **QR codes**: Displayed inline when sharing address

### Collapsible Header

**When Expanded:**
```
┌─────────────────────────────────────┐
│  ARCLE                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Total Balance                       │
│  $1,450.32 USDC                     │
│  ─────────────────────────────────   │
│  Arc: $1,200.00  Base: $250.32      │ ← Multi-chain breakdown
│  ─────────────────────────────────   │
│  Sub-Account: $50.00                 │ ← AI-managed budget
│                                      │
│  [Quick Actions]                    │
│  [Send] [Receive] [Bridge] [Pay]    │
│                                      │
│  [Collapse ▲]                        │
└─────────────────────────────────────┘
```

**When Collapsed:**
```
┌─────────────────────────────────────┐
│  ARCLE          $1,450.32 USDC      │ ← Just balance
└─────────────────────────────────────┘
```

### Transaction Preview Cards (Inline in Chat)

**Normal Transaction:**
```
┌─────────────────────────────────────┐
│  💸 Transaction Preview              │
│  ─────────────────────────────────  │
│  Send $50.00 USDC                    │
│  To: Jake (0x1234...5678)            │
│                                      │
│  Network: Arc                        │
│  Fee: ~$0.01 USDC                    │
│  ETA: < 3 seconds                     │
│                                      │
│  [🔒 Security Check] Passed          │
│  Risk Score: 15/100 ✅                │
│                                      │
│  [Confirm with Face ID] [Cancel]     │
└─────────────────────────────────────┘
```

**Scam Warning:**
```
┌─────────────────────────────────────┐
│  ⚠️ Security Warning                 │
│  ─────────────────────────────────  │
│  HIGH RISK TRANSACTION               │
│                                      │
│  🔴 Risk Score: 95/100               │
│                                      │
│  Issues Found:                       │
│  • New contract (0 days old)         │
│  • Similar to known scam patterns    │
│  • No verification badge             │
│                                      │
│  [View Details] [Report Scam]        │
│                                      │
│  [Transaction Blocked]               │ ← No override option
└─────────────────────────────────────┘
```

### Onboarding Screens

**Screen 1: Welcome**
- ARCLE logo/icon centered
- "Welcome to ARCLE" heading
- Tagline: "Your AI-powered blockchain wallet"
- "Get Started" button

**Screen 2: Face ID Setup**
- 🔒 Security icon
- "Secure Your Wallet" heading
- Face ID icon
- "Enable Face ID" button
- Explanation: No seed phrases needed

**Screen 3: Wallet Creation**
- ✨ "Creating Your Wallet" heading
- Animated loading/Circle logo
- Progress indicators:
  - ✓ Master wallet created
  - ✓ Sub-account ready
  - ⏳ Pre-funding $10 USDC...

**Screen 4: Tutorial (3 Swipes)**
- Card 1: "Just Chat" - Explain natural language
- Card 2: "AI Protection" - Explain scam detection
- Card 3: "Sub-Accounts" - Explain budget management
- Pagination dots (• ○ ○)
- "Next" button

### Side Panel / Drawer

Accessible via swipe or menu icon:
- Profile icon at top
- Navigation: Dashboard, Portfolio, Settings, Recovery Setup, Help
- Portfolio summary
- Sub-Account status (Budget: $50)
- Scheduled payments overview
- Log out

---

## Desktop UI Design (Three-Panel Split)

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  ARCLE          $1,450.32 USDC                    [Profile]     │ ← Top bar
├──────────────┬────────────────────────────┬──────────────────────┤
│              │                            │                      │
│  [Panel 1]   │   [Panel 2: Chat]          │  [Panel 3: Details] │
│  Sidebar     │   Interface                │  Documents/Receipts │
│              │                            │                      │
└──────────────┴────────────────────────────┴──────────────────────┘
```

### Panel 1: Left Sidebar (Navigation & Context)

**Width**: ~280px (collapsible to ~60px)

**Content:**
- ARCLE Logo
- Navigation menu:
  - 💬 Chat (Active)
  - 📊 Portfolio
  - ⚙️ Settings
  - 🔐 Recovery
- Total Balance widget
- Sub-Account status (Budget: $50.00)
- Scheduled payments overview
- Recent transactions list (clickable → opens in Panel 3)
- Help & Support
- Log Out

### Panel 2: Middle (Chat Interface)

**Width**: Flexible (~40-50% of screen)

**Content:**
- Optional search header
- Full chat conversation
- Inline transaction previews (clickable → opens in Panel 3)
- Message input at bottom
- Scrollable history
- Voice input button
- Transaction cards with "View Details" links

### Panel 3: Right (Details, Documents, Receipts)

**Width**: ~400px (collapsible)

**States:**

**1. Transaction Details View:**
- Transaction header with close button
- Transaction information:
  - Amount, Network, Status
  - From/To addresses
  - Transaction hash
  - Timestamp
- Documents & Attachments section:
  - 📄 Receipt.pdf (downloadable, viewable)
  - 🔗 Blockchain Explorer Link
  - Related files
- Transaction Analytics:
  - Gas fee
  - Speed
  - Risk score
- Related Contact info
- Action buttons: Share, Export Receipt, Report Issue

**2. Receipt PDF Viewer:**
- PDF embedded viewer
- Download, Print, Share buttons
- Back button to transaction details

**3. Link Collection View:**
- Grouped by type:
  - 📄 Receipts (count)
  - 🔗 Explorer Links (count)
  - 📎 Attachments (count)
- Export All button
- Share Collection button

**4. Empty State:**
- 📄 Icon
- "Select a transaction to view details, receipts, and links"
- Guidance text

### Panel Resizing

- Draggable dividers between panels
- Minimum widths:
  - Sidebar: 280px
  - Chat: 400px
  - Details: 350px
- User preferences saved

---

## Visual Design System

### Color Palette

**ARCLE Brand Colors** (See `.cursor/branding-guide.md` for full brand guidelines):

```
Rich Blue:   #012AFE - Primary brand color, CTAs, active states
Onyx:        #111111 - Primary text, dark backgrounds
Dark Grey:   #353535 - Secondary backgrounds, cards, surfaces
Casper:      #ABBBCB - Light accents, borders, subtle elements

Semantic Colors:
Success:     #10B981 - Confirmations, safe transactions
Warning:     #F59E0B - Medium risk, warnings
Danger:      #EF4444 - High risk, errors, blocked transactions
```

**Usage:**
- **Primary Actions**: Rich Blue (#012AFE) with white text
- **Backgrounds**: Onyx (#111111) for main, Dark Grey (#353535) for cards
- **Text**: White on dark, Onyx (#111111) on light
- **Accents**: Casper (#ABBBCB) for borders and subtle elements

### Typography

- **Headings**: Inter / SF Pro Display (bold, 20-32px)
- **Body**: Inter / SF Pro Text (regular, 16-18px)
- **Chat messages**: 15-16px
- **Transaction details**: 14px (muted)

### Component Styles

**Buttons:**
- Primary: Rich Blue (#012AFE) background, white text, rounded (12px), with icon
- Secondary: Transparent with Rich Blue (#012AFE) border and text, rounded (12px)
- Danger: Red (#EF4444) background for blocking actions
- Hover: Slightly darker Rich Blue for primary buttons

**Cards:**
- Background: Dark Grey (#353535)
- Border: Casper (#ABBBCB) or Dark Grey border
- Rounded corners (16px)
- Subtle shadow with Onyx (#111111) opacity
- Padding: 16-20px

**Input:**
- Background: Dark Grey (#353535) or Onyx (#111111)
- Border: Casper (#ABBBCB) or Dark Grey (#353535)
- Text: White or Onyx (#111111)
- Rounded search/message bar (12px border radius)
- Focus state: Rich Blue (#012AFE) border glow (2px)
- Voice button: Rich Blue (#012AFE), prominent, animated when listening

**Chat Messages:**
- User: Dark Grey (#353535) background, white text
- AI: Rich Blue (#012AFE) background, white text
- Both: Rounded (16px) on appropriate sides

---

## Interaction Patterns

### 1. Transaction Flow
1. User message → AI parsing
2. Preview card appears in chat
3. User confirms → Biometric auth
4. Transaction sent → Confirmation message
5. Receipt link appears → Clickable → Opens in Panel 3 (desktop) or modal (mobile)

### 2. Error Handling
- Errors appear inline in chat
- Error explanation with AI suggestions
- Retry button available

### 3. Scam Blocking
- Warning card replaces transaction preview
- Evidence visible (expandable)
- No override for high risk (>80)
- Report button available

### 4. Cross-Chain Bridging
- Multi-chain balance shown when bridging
- Progress indicator: Burn → Attest → Mint
- Real-time updates (~30 seconds)
- Completion confirmation with link to Panel 3

### 5. Scheduled Payments
- Listed in sidebar (desktop) or drawer (mobile)
- Reminders appear as chat messages
- Confirmation inline before execution
- History in Panel 3 (desktop)

### 6. Document Management
- Receipts auto-generated on transaction completion
- Stored in Panel 3 (desktop) or accessible via transaction details (mobile)
- PDF viewer embedded
- Download, share, print options
- Blockchain explorer links saved
- Related contacts linked

---

## Responsive Behavior

### Breakpoints

- **Mobile** (< 768px):
  - Single column layout
  - Chat interface primary
  - Drawer navigation
  - Details as full-screen modal

- **Tablet** (768px - 1024px):
  - Sidebar toggleable
  - Chat-focused layout
  - Details as slide-over panel or modal

- **Desktop** (> 1024px):
  - Three-panel split always visible
  - Persistent sidebar
  - Wide chat interface
  - Details panel always accessible

---

## Mobile-Specific Considerations

- **Thumb-friendly zones**: Buttons in easy reach
- **Swipe gestures**: 
  - Left swipe: View history
  - Right swipe: Open drawer
- **Pull to refresh**: Reload balance/transactions
- **Haptic feedback**: For confirmations and errors
- **Voice input**: Accessible from keyboard
- **Biometric auth**: Face ID/Touch ID prompts

---

## Desktop-Specific Features

- **Keyboard shortcuts**:
  - `Cmd/Ctrl + K`: Quick actions menu
  - `Enter`: Send message
  - `Tab`: Navigate between panels
- **Multi-select**: Select multiple transactions
- **Drag & drop**: Drag receipts to export
- **Window management**: Panel sizes remembered
- **Multi-window**: Open details in separate window

---

## User Flows Visualized

### Flow A: First Time User (Mobile)
1. Welcome screen → Get Started
2. Face ID setup
3. Wallet creation (loading animation)
4. Show wallet address + QR code
5. Add funds options
6. AI introduction chat
7. Sub-account setup prompt
8. Tutorial (3 swipes)
9. Dashboard ready

### Flow B: Send Money (Desktop)
1. Type "Send Jake $50" in Panel 2
2. AI parses → Preview card appears
3. Click preview → Panel 3 opens with details
4. Review in Panel 3
5. Confirm → Biometric prompt
6. Transaction sent → Confirmation in chat
7. Receipt auto-generated → Visible in Panel 3

### Flow C: View Receipt (Desktop)
1. Click transaction in chat or sidebar
2. Panel 3 opens with transaction details
3. Click "Receipt.pdf" in Documents section
4. PDF viewer opens in Panel 3
5. Download/Share options available

### Flow D: Scam Block (Mobile)
1. Malicious dApp requests approval
2. ARCLE intercepts → Contract analysis
3. Warning card appears (cannot dismiss)
4. Evidence shown (expandable)
5. Report option available
6. Transaction blocked

---

## Component Library Structure

### Core Components Needed:

1. **Chat Components:**
   - MessageBubble (User/AI variants)
   - TransactionPreviewCard
   - ScamWarningCard
   - ConfirmationCard
   - ReceiptLink

2. **Navigation Components:**
   - Sidebar (Desktop)
   - Drawer (Mobile)
   - TopBar
   - NavigationMenu

3. **Transaction Components:**
   - TransactionDetails
   - ReceiptViewer
   - DocumentList
   - LinkCollection
   - TransactionAnalytics

4. **Onboarding Components:**
   - WelcomeScreen
   - BiometricSetup
   - WalletCreation
   - TutorialCarousel

5. **Utility Components:**
   - BalanceDisplay
   - QRCodeDisplay
   - RiskScoreIndicator
   - ProgressIndicator
   - EmptyState

---

## Design Files Needed

- [ ] Mobile wireframes (all screens)
- [ ] Desktop wireframes (three-panel layouts)
- [ ] Component designs (buttons, cards, inputs)
- [ ] AI avatar design
- [ ] Icon set
- [ ] Animation specifications
- [ ] Responsive breakpoint designs
- [ ] Dark mode variants (if needed)

---

## Implementation Notes

- Use **shadcn/ui** + **Tailwind CSS** for components
- **Brand Colors**: See `.cursor/branding-guide.md` for full brand guidelines and color usage
- Mobile-first responsive design
- React Native for mobile OR Next.js with mobile optimization
- Panel resizing library for desktop (react-resizable-panels)
- PDF viewer library (react-pdf or similar)
- QR code generation library (qrcode.react)
- Animation library (framer-motion)

### Brand Color Implementation

When implementing, use these CSS variables (matching brand guide):

```css
:root {
  --color-rich-blue: #012AFE;
  --color-onyx: #111111;
  --color-dark-grey: #353535;
  --color-casper: #ABBBCB;
}
```

Or Tailwind config:
```javascript
colors: {
  'rich-blue': '#012AFE',
  'onyx': '#111111',
  'dark-grey': '#353535',
  'casper': '#ABBBCB',
}
```

---

**Last Updated**: Initial UI design planning
**Status**: Ready for wireframe creation and component design

