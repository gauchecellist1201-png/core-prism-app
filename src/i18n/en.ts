// ============================================================
// CORE Prism — English
// AI-translated from src/i18n/ja.ts (translation reviewed for tone)
// ============================================================

import type { Dictionary } from './ja';

export const en: Dictionary = {
  banner: '✦ Beta launch May 12, 2026 — 14-day free trial / No credit card / +30 days for early adopters',

  nav: {
    agents:  '7 Agents',
    exec:    'Execution AI',
    pricing: 'Pricing',
    faq:     'FAQ',
    cta:     'Try free →',
  },

  hero: {
    eyebrow: 'CORE PRISM — 14 AI EXECUTIVES, RUNNING YOUR COMPANY',
    h1Line1: '14 AI executives,',
    h1Line2: 'running your company 24/7.',
    sub1: 'You just approve.',
    sub2: 'Meetings · Sales · Finance · Content — everything moves on its own.',
    cta:  'Start 7-day free trial',
    cta2: 'See pricing',
    sample: 'Try with sample data',
    sampleNote: '(experience a fictional café owner)',
    free: '7 days fully free · No credit card · Cancel in one tap',
  },

  agents: {
    eyebrow: '7 AGENTS, 1 OS',
    h2Line1: 'From strategy to daily life,',
    h2Line2: '7 kinds of work, handled.',
    sub: "Strategy, sales, finance, creative, learning, people, life — each gets a dedicated AI that thinks, writes, researches, and organizes. It doesn't just suggest — it executes.",
    execHighlight: 'executes',
    suffix: '',
    items: {
      red:    { name: 'Strategy', role: 'CEO Agent',       desc: 'Strategy planning, KPI auto-monitoring, decision memos' },
      orange: { name: 'Sales',    role: 'Sales Agent',     desc: 'Lead discovery, call scripts, proposal drafts, objection handling' },
      yellow: { name: 'Finance',  role: 'CFO Agent',       desc: 'Auto P&L, expense OCR, budget allocation, cash forecasting' },
      green:  { name: 'Creative', role: 'Creative Agent',  desc: 'Image generation, captions, brand design, slide automation' },
      blue:   { name: 'Learning', role: 'Knowledge Agent', desc: 'YouTube summaries, reading notes, knowledge graph, cross search' },
      indigo: { name: 'People',   role: 'People Agent',    desc: '1:1 history, sentiment analysis, hiring interviews, team care' },
      violet: { name: 'Life',     role: 'Life Agent',      desc: 'Health, schedule, family plans, mental balance' },
    },
  },

  exec: {
    eyebrow: 'EXECUTION, NOT JUST SUGGESTIONS',
    h2Line1: 'Beyond suggestions.',
    h2Line2: 'Write. Organize. Submit.',
    sub: 'Minutes, slides, contracts, sales emails, negotiation roleplay — agents handle the work itself.',
    workHighlight: 'the work itself',
    items: {
      minutes:  { label: 'Minutes AI',   desc: 'Record → summary, task extraction, follow-up email' },
      slides:   { label: 'Slides AI',    desc: 'Outline, script, and design — all in one command' },
      contract: { label: 'Contract AI',  desc: 'NDA, services, rentals — templates + risk flags' },
      deal:     { label: 'Deal AI',      desc: 'Objection roleplay, sharper talk tracks, next moves' },
      email:    { label: 'Email AI',     desc: 'Inbox swept every 30 min, drafts pre-written' },
      invoice:  { label: 'Invoice AI',   desc: 'Quote → PO → delivery → invoice, end to end' },
      image:    { label: 'Image AI',     desc: 'On-brand posts, thumbnails, OG images' },
      voice:    { label: 'Voice Input',  desc: 'Just speak — thoughts auto-classified and organized' },
    },
  },

  prism: {
    eyebrow: 'ONE PRISM, ALL LIGHT',
    h2Line1: 'The era of switching SaaS,',
    h2Line2: 'is over.',
    body: 'CRM, minutes, image generation, slides, email, health records — all of it, ',
    bodyEm: 'inside one PRISM',
    bodyTail: '.',
    sub: 'Use ⌘+K to search across 7 agents, switch personas to refresh your entire context. Input by text, voice, or image.',
    briefLabel: "Today's brief",
    briefBody: 'New outreach in the morning, the proposal is already drafted by your agent for the afternoon.',
    todoItems: ['＋ Proposal for ◯◯ Inc.', '＋ Expense OCR (3 items)', '＋ Gmail reply drafts (5)', '＋ Next-week P&L review'],
  },

  pricing: {
    eyebrow:   'PRICING',
    h2Lead:    'Grow as you use it —',
    h2Accent:  'your potential, unlocked.',
    sub:       'Claude / Gemini / Stable Diffusion built-in on every plan. No API key required.',
    popular:   'Popular',
    ctaTrial:  'Try free for 14 days',
    ctaApply:  'Get started now',
    annual:    'Annual billing: 2 months off · Enterprise: contact us',
    suffixMonth: '/ month',
    plans: {
      starter: {
        name: 'Starter',
        tag:  'Solo / side projects',
        price: '$32',
        features: [
          '3 personas (Strategy / Sales / +1)',
          'Deal, Minutes, Slides AI',
          'Cmd+K cross-search',
          'PWA / offline support',
        ],
      },
      standard: {
        name: 'Standard',
        tag:  'Freelance / small team',
        price: '$65',
        features: [
          '7 personas (all agents)',
          'Proposal / Contract / Finance AI',
          'Gmail shadow secretary (reply drafts)',
          'YouTube import → knowledge',
          'CRM deals, quote → invoice in one flow',
        ],
      },
      exclusive: {
        name: 'Exclusive',
        tag:  'Executives / teams',
        price: '$198',
        features: [
          'Everything in Standard',
          'People care (1:1 + sentiment)',
          'API access + Webhook',
          'Team sharing (up to 5 seats)',
          'Priority support + strategy coach',
        ],
      },
    },
  },

  faq: {
    eyebrow: 'FAQ',
    h2: 'Frequently asked questions',
    sub: "If you're not sure, start here.",
    items: [
      {
        q: 'Do I need to register an API key?',
        a: 'No. Claude, Gemini, and Stable Diffusion are built into CORE Prism. All agents work from day one — no additional setup needed.',
      },
      {
        q: 'Will I be charged automatically after the free trial?',
        a: "No. You don't need to enter a credit card to start the trial. After 14 days, you won't be billed automatically. You decide whether to continue.",
      },
      {
        q: 'Does it fit my industry?',
        a: 'Yes. CORE Prism organizes agents by role — not by industry — so anyone running business activities (strategy, sales, finance, etc.) can use it. Professionals, creators, and healthcare teams are already on board.',
      },
      {
        q: 'Is my data safe?',
        a: 'Yes. All data is encrypted and isolated per customer. We never use your data to train AI models. See our Privacy Policy for details.',
      },
      {
        q: 'Can I share with my team?',
        a: 'The Exclusive plan supports team sharing for up to 5 people. For larger deployments, please contact us.',
      },
      {
        q: 'Is it easy to cancel?',
        a: 'Yes. You can cancel anytime in one click from settings. No fees, no friction.',
      },
    ],
  },

  final: {
    h2Lead:   'For the',
    h2Accent: '7 possibilities',
    h2Tail:   'within you, agent AI awaits.',
    sub: 'Try all agents free for 14 days.',
    cta: 'Try Prism for free',
  },

  footer: {
    tagline:     'Agent AI for every entrepreneur.',
    product:     'PRODUCT',
    company:     'COMPANY',
    contact:     'CONTACT',
    agents:      '7 Agents',
    exec:        'Execution AI',
    pricing:     'Pricing',
    iris:        'Sister brand · CORE Iris',
    terms:       'Terms of Service',
    privacy:     'Privacy Policy',
    tokushou:    'Commercial Transactions Act',
    contactText: 'Enterprise contracts & custom deployments:',
    copyright:   '© {year} CORE Prism · Built with care',
  },
};
