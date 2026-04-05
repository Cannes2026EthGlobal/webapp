# Arc Counting — Architecture Diagram

## System Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#e0f2fe', 'primaryTextColor': '#0c4a6e', 'lineColor': '#64748b', 'fontSize': '14px'}}}%%
graph TB
    subgraph FE["Frontend — Next.js 16 / React 19"]
        direction TB
        UI["Dashboard Shell<br/>TailwindCSS 4 + shadcn/ui"]
        PAGES["Pages: Overview, Employees,<br/>Customers, Products, Payroll,<br/>Treasury, AI Chat, Settings"]
        PORTAL["Employee Portal<br/>+ Public Checkout"]
        WALLET["Reown AppKit + Wagmi<br/>Wallet Connection"]
    end

    subgraph API["API Routes — Next.js Server"]
        direction TB
        PAY_API["/api/pay — create, status, webhook"]
        USAGE_API["/api/usage — record, bill, tab"]
        AI_API["/api/ai — chat, analyze, usage"]
        AGENT_API["/api/agent — keys, session"]
    end

    subgraph CONVEX["Backend — Convex Serverless"]
        direction TB
        QUERIES["Queries: users, companies, employees,<br/>customers, products, payments,<br/>balances, overview, creditRequests"]
        MUTATIONS["Mutations: CRUD for all entities,<br/>checkout, billing, advances,<br/>balance credits/debits"]
        ACTIONS["Actions: dispatch USDC,<br/>trigger CRE payroll, cron jobs"]
        DB[("Database<br/>22 Tables")]
    end

    subgraph CHAIN["Blockchain — Arc Testnet"]
        direction TB
        PAYROLL["Payroll.sol<br/>CRE-triggered salary"]
        ESCROW["AdvanceEscrow.sol<br/>Salary advance escrow"]
        TOKENS["USDC + EURC"]
    end

    subgraph EXT["External Services"]
        direction TB
        WCPAY["WalletConnect Pay<br/>Checkout Payments"]
        CRE_SVC["Chainlink CRE<br/>Payroll Automation"]
        CCTP["Circle CCTP v2<br/>Cross-chain Bridge"]
        CLAUDE["Anthropic Claude<br/>AI Assistant"]
        REOWN["Reown Auth<br/>Wallet Provider"]
    end

    subgraph BRIDGES["Settlement Bridges"]
        ARB["Arbitrum Sepolia"]
        BASE["Base Sepolia"]
    end

    FE -->|"HTTP + JSON"| API
    FE -->|"WebSocket real-time"| CONVEX
    WALLET -->|"RPC"| CHAIN
    WALLET -->|"Auth"| REOWN

    API -->|"ConvexHttpClient"| CONVEX
    PAY_API -->|"REST"| WCPAY
    AI_API -->|"Streaming"| CLAUDE

    ACTIONS -->|"viem RPC"| CHAIN
    ACTIONS -->|"Confidential HTTP"| CRE_SVC
    CRE_SVC -->|"onReport"| PAYROLL

    CCTP ---|"Burn/Mint USDC"| CHAIN
    CCTP ---|"Burn/Mint USDC"| ARB
    CCTP ---|"Burn/Mint USDC"| BASE

    QUERIES --> DB
    MUTATIONS --> DB

    style FE fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a5f
    style API fill:#fef9c3,stroke:#eab308,stroke-width:2px,color:#713f12
    style CONVEX fill:#d1fae5,stroke:#10b981,stroke-width:2px,color:#064e3b
    style CHAIN fill:#ede9fe,stroke:#8b5cf6,stroke-width:2px,color:#3b0764
    style EXT fill:#fce7f3,stroke:#ec4899,stroke-width:2px,color:#831843
    style BRIDGES fill:#e0e7ff,stroke:#6366f1,stroke-width:2px,color:#312e81

    style UI fill:#bfdbfe,stroke:#2563eb,color:#1e3a5f
    style PAGES fill:#bfdbfe,stroke:#2563eb,color:#1e3a5f
    style PORTAL fill:#bfdbfe,stroke:#2563eb,color:#1e3a5f
    style WALLET fill:#93c5fd,stroke:#1d4ed8,color:#1e3a5f

    style PAY_API fill:#fef08a,stroke:#ca8a04,color:#713f12
    style USAGE_API fill:#fef08a,stroke:#ca8a04,color:#713f12
    style AI_API fill:#fef08a,stroke:#ca8a04,color:#713f12
    style AGENT_API fill:#fef08a,stroke:#ca8a04,color:#713f12

    style QUERIES fill:#a7f3d0,stroke:#059669,color:#064e3b
    style MUTATIONS fill:#a7f3d0,stroke:#059669,color:#064e3b
    style ACTIONS fill:#6ee7b7,stroke:#047857,color:#064e3b
    style DB fill:#34d399,stroke:#047857,color:#064e3b

    style PAYROLL fill:#c4b5fd,stroke:#7c3aed,color:#3b0764
    style ESCROW fill:#c4b5fd,stroke:#7c3aed,color:#3b0764
    style TOKENS fill:#ddd6fe,stroke:#7c3aed,color:#3b0764

    style WCPAY fill:#fbcfe8,stroke:#db2777,color:#831843
    style CRE_SVC fill:#fbcfe8,stroke:#db2777,color:#831843
    style CCTP fill:#fbcfe8,stroke:#db2777,color:#831843
    style CLAUDE fill:#fbcfe8,stroke:#db2777,color:#831843
    style REOWN fill:#fbcfe8,stroke:#db2777,color:#831843

    style ARB fill:#c7d2fe,stroke:#4f46e5,color:#312e81
    style BASE fill:#c7d2fe,stroke:#4f46e5,color:#312e81
```

### Legend

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '13px'}}}%%
graph LR
    L1["Frontend"]
    L2["API Layer"]
    L3["Backend"]
    L4["Blockchain"]
    L5["External Services"]
    L6["Bridges"]

    style L1 fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a5f
    style L2 fill:#fef9c3,stroke:#eab308,stroke-width:2px,color:#713f12
    style L3 fill:#d1fae5,stroke:#10b981,stroke-width:2px,color:#064e3b
    style L4 fill:#ede9fe,stroke:#8b5cf6,stroke-width:2px,color:#3b0764
    style L5 fill:#fce7f3,stroke:#ec4899,stroke-width:2px,color:#831843
    style L6 fill:#e0e7ff,stroke:#6366f1,stroke-width:2px,color:#312e81
```

---

## Data Flow Diagrams

### Payroll Settlement Flow — Outbound

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'actorBkg': '#dbeafe', 'actorBorder': '#3b82f6', 'actorTextColor': '#1e3a5f', 'activationBkgColor': '#bfdbfe', 'activationBorderColor': '#3b82f6', 'signalColor': '#334155', 'signalTextColor': '#1e293b', 'noteBkgColor': '#fef9c3', 'noteBorderColor': '#eab308', 'noteTextColor': '#713f12', 'labelBoxBkgColor': '#f8fafc', 'labelTextColor': '#334155'}}}%%
sequenceDiagram
    box rgb(219, 234, 254) Operator
        participant Op as Operator Dashboard
    end
    box rgb(209, 250, 229) Backend
        participant CX as Convex Backend
    end
    box rgb(252, 231, 243) Chainlink
        participant CRE as Chainlink CRE
    end
    box rgb(237, 233, 254) On-Chain
        participant PAY as Payroll.sol on Arc
        participant EW as Employee Wallet
    end

    Op->>CX: Create salary payment draft
    activate CX
    Op->>CX: Approve payment batch
    CX->>CX: employeePayments status → approved
    deactivate CX
    CRE->>CX: Fetch pending payments via Confidential HTTP
    activate CX
    CX-->>CRE: Return recipient + amount pairs
    deactivate CX
    activate CRE
    CRE->>CRE: Encode report on DON via WASM
    CRE->>PAY: KeystoneForwarder → onReport
    deactivate CRE
    activate PAY
    PAY->>PAY: _processReport — decode recipients
    PAY->>EW: Transfer USDC to each employee
    PAY-->>CX: Emit event with txHash
    deactivate PAY
    activate CX
    CX->>CX: employeePayments status → settled
    deactivate CX
```

### Customer Payment Flow — Inbound

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'actorBkg': '#dbeafe', 'actorBorder': '#3b82f6', 'actorTextColor': '#1e3a5f', 'activationBkgColor': '#bfdbfe', 'activationBorderColor': '#3b82f6', 'signalColor': '#334155', 'signalTextColor': '#1e293b', 'noteBkgColor': '#fef9c3', 'noteBorderColor': '#eab308', 'noteTextColor': '#713f12'}}}%%
sequenceDiagram
    box rgb(237, 233, 254) Customer
        participant CU as Customer
    end
    box rgb(219, 234, 254) Frontend
        participant CK as Checkout Page
    end
    box rgb(254, 249, 195) API
        participant API as Next.js API
    end
    box rgb(252, 231, 243) Payment
        participant WC as WalletConnect Pay
    end
    box rgb(209, 250, 229) Backend
        participant CX as Convex Backend
        participant DP as Dispatch Action
    end

    CU->>CK: Visit checkout page
    CK->>API: POST productId, amount, currency
    activate API
    API->>CX: checkout.initiateCheckout
    activate CX
    CX->>CX: Create customerPayment as pending
    deactivate CX
    API->>WC: createPayment with referenceId + amount
    activate WC
    WC-->>API: Return gatewayUrl + paymentId
    deactivate WC
    API-->>CK: Redirect to WC Pay gateway
    deactivate API
    CU->>WC: Pay via wallet
    activate WC
    WC->>API: Webhook — status succeeded
    deactivate WC
    activate API
    API->>CX: customerPayments.recordWcPaySuccess
    deactivate API
    activate CX
    CX->>CX: Status → paid
    CX->>DP: dispatchRecords.create
    deactivate CX
    activate DP
    DP->>DP: Send USDC to company treasury
    DP->>CX: dispatchRecords.updateStatus confirmed
    deactivate DP
```

### Usage-Based Billing Flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'actorBkg': '#dbeafe', 'actorBorder': '#3b82f6', 'actorTextColor': '#1e3a5f', 'activationBkgColor': '#bfdbfe', 'activationBorderColor': '#3b82f6', 'signalColor': '#334155', 'signalTextColor': '#1e293b', 'noteBkgColor': '#fef9c3', 'noteBorderColor': '#eab308', 'noteTextColor': '#713f12'}}}%%
sequenceDiagram
    box rgb(237, 233, 254) Client
        participant Dev as Developer or Agent
    end
    box rgb(254, 249, 195) API
        participant API as Usage API
    end
    box rgb(209, 250, 229) Backend
        participant CX as Convex Backend
    end
    box rgb(219, 234, 254) Operator
        participant Op as Operator Dashboard
    end
    box rgb(252, 231, 243) Payment
        participant WC as WalletConnect Pay
    end

    Dev->>API: POST usage event — units, productId
    activate API
    API->>CX: usageTabs.recordUsage
    deactivate API
    activate CX
    CX->>CX: Create or append to open tab
    CX->>CX: Insert usageEntry for audit
    deactivate CX
    Note over CX: Tab accumulates usage over time
    Op->>CX: Bill tab — usageTabs.billTab
    activate CX
    CX->>CX: Tab status → billed
    CX->>CX: Create customerPayment
    CX->>WC: Generate checkout link
    deactivate CX
    activate WC
    WC-->>CX: Payment gateway URL
    deactivate WC
    Note over WC: Customer pays via checkout flow
```

### Salary Advance Flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'actorBkg': '#dbeafe', 'actorBorder': '#3b82f6', 'actorTextColor': '#1e3a5f', 'activationBkgColor': '#bfdbfe', 'activationBorderColor': '#3b82f6', 'signalColor': '#334155', 'signalTextColor': '#1e293b', 'noteBkgColor': '#fef9c3', 'noteBorderColor': '#eab308', 'noteTextColor': '#713f12'}}}%%
sequenceDiagram
    box rgb(237, 233, 254) Employee
        participant EE as Employee
        participant EP as Employee Portal
    end
    box rgb(209, 250, 229) Backend
        participant CX as Convex Backend
    end
    box rgb(219, 234, 254) Operator
        participant Op as Operator Dashboard
    end
    box rgb(237, 233, 254) On-Chain
        participant AE as AdvanceEscrow on Arc
    end

    EE->>EP: View salary forecast
    EE->>EP: Request advance — amount + reason
    EP->>CX: creditRequests.create as pending
    activate CX
    CX->>CX: Calculate interest — rate x days
    deactivate CX
    Op->>CX: creditRequests.approveRequest
    activate CX
    CX->>CX: Status → approved
    deactivate CX
    Op->>AE: createAdvance — employee, amount, repayDate
    activate AE
    AE->>AE: Escrow USDC
    AE->>EE: Release advance to wallet
    Note over AE: At next paycheck cycle
    AE->>AE: deductFromPayroll — principal + interest
    EE->>AE: repayAdvance
    AE-->>CX: Advance settled
    deactivate AE
    activate CX
    CX->>CX: creditRequests status → settled
    deactivate CX
```

### Authentication and Workspace Resolution

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'actorBkg': '#dbeafe', 'actorBorder': '#3b82f6', 'actorTextColor': '#1e3a5f', 'activationBkgColor': '#bfdbfe', 'activationBorderColor': '#3b82f6', 'signalColor': '#334155', 'signalTextColor': '#1e293b', 'noteBkgColor': '#fef9c3', 'noteBorderColor': '#eab308', 'noteTextColor': '#713f12', 'altSectionBkgColor': '#f0fdf4', 'labelBoxBkgColor': '#e0f2fe'}}}%%
sequenceDiagram
    box rgb(237, 233, 254) User
        participant U as User
    end
    box rgb(252, 231, 243) Auth
        participant RO as Reown AppKit
    end
    box rgb(219, 234, 254) Frontend
        participant FE as Frontend Next.js
    end
    box rgb(209, 250, 229) Backend
        participant CX as Convex Backend
    end

    U->>RO: Connect Wallet
    activate RO
    RO-->>FE: wallet address
    deactivate RO
    FE->>CX: users.getByWallet address
    activate CX
    alt New user
        CX-->>FE: null
        FE->>CX: users.createOrUpdate address
        CX-->>FE: userId
    else Existing user
        CX-->>FE: user record
    end
    deactivate CX
    FE->>CX: companies.getByUserId userId
    activate CX
    CX-->>FE: company list
    deactivate CX
    alt No companies
        FE->>FE: Show Onboarding Wizard
        FE->>CX: companies.create — name, details
    else Has companies
        FE->>FE: Select active company from localStorage
    end
    FE->>FE: Render Dashboard Shell
```

---

## Database Schema Overview

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '13px', 'entityRelationship': {'titleColor': '#1e3a5f', 'entityBorder': '#3b82f6', 'entityBkg': '#f0f9ff', 'entityTextColor': '#1e3a5f', 'relationshipColor': '#64748b', 'attributeBackgroundColorOdd': '#e0f2fe', 'attributeBackgroundColorEven': '#f0f9ff'}}}}%%
erDiagram
    users ||--o{ companyMembers : "has roles"
    companies ||--o{ companyMembers : "has members"
    companies ||--o{ employees : "employs"
    companies ||--o{ customers : "bills"
    companies ||--o{ products : "offers"
    companies ||--o{ companyBalances : "holds"

    employees ||--o{ compensationLines : "earns"
    employees ||--o{ employeePayments : "receives"
    employees ||--o{ creditRequests : "requests advances"
    compensationLines ||--o{ compensationSplits : "splits payout"

    customers ||--o{ customerPayments : "pays"
    customers ||--o{ usageTabs : "accumulates usage"
    products ||--o{ checkoutLinks : "has links"
    products ||--o{ customerPayments : "generates revenue"

    usageTabs ||--o{ usageEntries : "records events"
    companies ||--o{ dispatchRecords : "dispatches funds"
    companies ||--o{ balanceEntries : "ledger entries"
    companies ||--o{ agentApiKeys : "issues keys"
    companies ||--o{ aiChatSessions : "AI conversations"
```

---

## Technology Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend** | Next.js 16, React 19, TypeScript | Full-stack web framework |
| **UI** | TailwindCSS 4, shadcn/ui, Radix UI | Component library and styling |
| **Wallet** | Reown AppKit, Wagmi, viem | Wallet connection and on-chain interaction |
| **Backend** | Convex serverless | Real-time database, queries, mutations, actions |
| **Blockchain** | Arc Testnet, Solidity, Foundry | Smart contracts for payroll and advances |
| **Payments** | WalletConnect Pay | Customer checkout and USDC settlement |
| **Automation** | Chainlink CRE | Scheduled on-chain payroll execution |
| **Bridging** | Circle CCTP v2 | Cross-chain USDC/EURC transfers |
| **AI** | Anthropic Claude, Vercel AI SDK | Dashboard assistant and analytics |
| **Validation** | Zod | Schema-based input validation |
