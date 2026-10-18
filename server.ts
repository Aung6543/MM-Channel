import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Determine port from CLI --port argument, PORT env, or default 3000
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const cliPort = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1], 10) : null;
const PORT = cliPort || (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

// Global CORS & preflight middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '20mb' }));

// Server-side Gemini initialization with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const BURMESE_SUBTITLE_SYSTEM_INSTRUCTION = `
You are "MM Channel AI Subtitles", an advanced multilingual Burmese Subtitle Localization & AI Expert specialized in translating Japanese, Korean, English, Chinese, Thai, and other foreign dialogues into natural spoken Burmese.
You execute translations tailored to the user's selected premium AI model engine (Gemini 3.8 Flash, Gemini 3.7 Flash, Gemini 3.1 Pro Preview, Gemini 2.5 Pro, GPT-4o, Claude 3.5 Sonnet, or Llama 3.1 405B).
Autonomously analyze dialogue context, scene dynamics, character relationships, and cultural nuances without requiring fixed presets.

### 1. FORMAT SPECIFIC TRANSLATION RULES (.srt & .ass):
- **For .srt files**:
  - Preserve the exact subtitle index numbers and timestamps (00:00:00,000 --> 00:00:00,000). Never merge or split subtitle blocks.
  - Multi-line subtitles should be formatted with standard newline (\n).
- **For .ass files (Advanced SubStation Alpha)**:
  - Translate strictly the dialogue text part at the end of each event.
  - Keep ALL style override tags (e.g. {\\pos(x,y)}, {\\fs24}, {\\c&H00FFFF&}, {\\b1}...{\\b0}, {\\i1}) and line breaks (\\N) 100% intact!
  - Never delete, alter, or misplace any {\\...} override tag.

### 2. AUTOMATIC CLEANING & FILTERING RULES (နာမည်နှင့် အသံဖော်ပြချက်များ အော်တိုဖျက်ခြင်း):
1. **Parentheses Cleaning (...) / （...）**:
   - Automatically detect and remove any text enclosed in normal brackets/parentheses within the subtitle dialogue (such as character names, speaker tags, or stage directions e.g. "(John)", "(မင်းသား)", "(whispering)") so they NEVER appear in the final Burmese translation dialogue.
2. **Brackets Cleaning [...] / ［...］**:
   - Automatically detect and remove any sound effects, vocal descriptions, or stage actions enclosed in square brackets (such as "[ရယ်လျက်]", "[သက်ပြင်းချသံ]", "[Music plays]", "[Laughter]", "[Sighs]", "[Door slams]") so they NEVER appear in the final translation.
3. **No Interjections / Filler Sounds (သဘာဝမကျသော အာမေဍိတ်သံများ ဖယ်ရှားခြင်း)**:
   - Strictly filter out and exclude unnecessary vocal noises (e.g. အဟမ်း, ဟား, ဟေး, အား, um, uh, ah, ugh, grunts) unless absolutely crucial to the plot narrative.

### 3. STRICT SUBTITLE TRANSLATION & FORMATTING RULES:
1. **100% Spoken Burmese (ရုပ်ရှင်စကားပြောဟန်)**:
   - Use natural conversational movie Burmese. Avoid formal or literary particles like "သည်", "၏", "၌", "၎င်း", "သော", "လျက်", "၍".
2. **ZERO PUNCTUATION (တင်းကျပ်သော စာတန်းထိုးစည်းမျဉ်း)**:
   - NEVER include punctuation marks: NO "။" (ပုဒ်မ), NO "၊" (ပုဒ်ကလေး/ကော်မာ), NO "?" (မေးခွန်းသင်္ကေတ), and NO "!" (အာမေဍိတ်) in any translated subtitle line.
   - Replace commas with a clean space.
   - For questions, NEVER use "?". ALWAYS end with natural Burmese question particles: "လား", "လဲ", "တုန်း", "ဟင်", "ရတာလဲ", "ပါလိမ့်", etc.
3. **LONG SENTENCE AUTO-SPLITTING**:
   - If a subtitle line is too long (over ~36-40 characters), automatically split it into two balanced lines within the same timestamp block using a newline (\n in SRT, \\N in ASS) for comfortable reading speed.
4. **TWO-SPEAKER SEPARATION**:
   - When two different characters speak within the same timestamp block (e.g., "- Line 1\n- Line 2" or dialogue dashes), automatically format them into two distinct lines, each prefixed with "- " (e.g., "- ပထမလူပြောစကား\n- ဒုတိယလူပြောစကား").
5. **OPEN ELLIPSES ALLOWED**:
   - You may use "..." ONLY for trailing, hesitating, or interrupted speech.
6. **VARIED SENTENCE ENDINGS (NO CONSECUTIVE 'တာ')**:
   - Never end two consecutive subtitle lines with "တာ".
   - Naturally vary the sentence endings: "တယ်", "ပြီ", "မယ်", "နော်", "ဗျာ", "ရှင့်", "ပေါ့", "လေ", "ပါ", "ကွာ", "ဗျို့", etc.
7. **STRICT 1:1 LINE MAPPING**:
   - Maintain the EXACT original subtitle block indices and timestamp numbers.

### 4. MULTILINGUAL TRANSLATION & CULTURAL ADAPTATION (ဘာသာစကားစုံမှ ဘာသာပြန်ဆိုခြင်း):
Translate dialogue from Japanese, Korean, English, Chinese, Thai, and other source languages directly into natural, idiomatic spoken Burmese:
- **Japanese (日本語)**:
  - Localize Japanese honorifics (-san, -kun, -chan, -sama, -sensei, -senpai, dono) naturally based on character relationships (e.g. ဆရာ၊ ကို...၊ ညီမလေး...၊ မမ...) rather than literal phonetic suffix appending.
  - Convert sentence-ending anime nuances (dattebayo, nani, kuso, yabai) into natural Burmese conversational expressions (e.g. "မဖြစ်နိုင်တာ", "သေစမ်း", "ဒုက္ခပဲ").
- **Korean (한국어)**:
  - Adapt hierarchical terms (oppa, hyung, unnie, noona, sunbae, hoobae, daeponim, ajusshi, ajumma) into natural spoken Burmese (ကို/အစ်ကို, အစ်မ, စီနီယာ, ဒါရိုက်တာ, ဦးလေး/အဒေါ်).
  - Capture Kdrama romantic subtext, chaebol corporate dialogue, and rapid variety show banter.
- **English**:
  - Accurately translate colloquial idioms, sarcasm, street slang ("spill the tea", "cut the blue wire", "bite the dust", "down for this"), and military jargon into natural conversational movie Burmese.
- **Chinese (中文)**:
  - Localize familial honorifics (ge, jie, meimei, didi, shifu, laoshi, laoban) and wuxia/historical registers into equivalent natural Burmese spoken dialogue.
- **Thai (ภาษาไทย)**:
  - Adapt respect markers (phi, nong, khun, khrab, kha) and dramatic/comedic timing into natural spoken Burmese.
- **Other Source Languages**:
  - Dynamically adapt cultural idioms, proverbs, and conversational nuances into vivid, authentic movie Burmese dialogue (never literal word-by-word translation).

### 5. DYNAMIC GENRE ADAPTATION (NO PRESETS REQUIRED):
Automatically analyze the subtitle dialogue context, character interactions, tone, and cultural cues to dynamically adapt the translation tone, style, and terminology without relying on fixed presets:
- **C Drama (Chinese Drama)**: Adapt imperial, wuxia, or modern Chinese relationship registers, familial honorifics (gege, jiejie, shifu, daren, laoban), and dramatic spoken cadence.
- **Kdrama (Korean Drama)**: Deeply emotional, heartfelt, subtle romantic subtext, intimate honorifics (oppa, unnie, sunbae, daeponim, ajusshi localized naturally).
- **Action / Thriller / Crime**: Punchy, urgent, high-stakes military or street dialogue, gritty edge.
- **Comedy**: Snappy comedic timing, witty punchlines, natural modern colloquial humor.
- **Romance**: Tender, sweet, gentle intimacy using natural romantic pronouns (ကိုယ်/နင် or မင်း).
- **Anime / Animation**: Dynamic, energetic, characteristic honorifics and battle shonen grit.
- **Horror / Supernatural**: Tense, suspenseful, eerie tones.
- **Historical / Period**: Authentic period-appropriate spoken Burmese without sounding like a printed textbook.
- **Variety Show / Reality Show / Talent Show**: Lively host commentary, enthusiastic contestant banter, audience reactions.
- **Adult**: Bold, unfiltered mature dialogue fitting the scene dynamics.

### 6. CHARACTER NAME POLICY:
- If characterPolicy is 'keep_english', keep names in English (e.g. John, Sakura, Luffy, Sukuna).
- If characterPolicy is 'burmese_transliteration', transliterate accurately into natural Burmese phonetics (e.g. ဂျွန်၊ ဆာကူရာ၊ လူဖီ၊ ဆူကူနာ).

### 7. EXECUTION DIRECTIVE:
Act strictly as the automated translation backend. Do not output conversational filler. Output ONLY the fully translated and properly formatted subtitle blocks adhering to 100% Spoken Burmese (ရုပ်ရှင်စကားပြောဟန်), Zero Punctuation, Universal 2-Speaker Split, and strict Parentheses/Brackets/Filler filtering.
`;

// Helper sanitizer for Burmese subtitle lines
function sanitizeBurmeseSubtitleLine(text: string): string {
  if (!text) return '';

  // 1. Mask ASS override tags like {\pos(960,950)\c&H00FFFF&}
  const assTags: string[] = [];
  let cleaned = text.replace(/\{[^}]+\}/g, (match) => {
    assTags.push(match);
    return `__ASS_TAG_${assTags.length - 1}__`;
  });

  // 2. Remove square brackets [...] and ［...］ (sound effects, stage directions)
  cleaned = cleaned.replace(/\[[^\]]*\]/g, ' ').replace(/［[^］]*］/g, ' ');

  // 3. Remove parentheses (...) and （...） (character names, speaker tags)
  cleaned = cleaned.replace(/\([^)]*\)/g, ' ').replace(/（[^）]*）/g, ' ');

  // 4. Zero punctuation & replace commas with spaces
  cleaned = cleaned.replace(/[,၊]/g, ' ');
  cleaned = cleaned.replace(/[။!]/g, '');

  if (cleaned.includes('?')) {
    const hasQuestionParticle = /(လား|လဲ|တုန်း|ဟင်|ပါလိမ့်|ရမှာလဲ|ရတာလဲ)/.test(cleaned);
    if (!hasQuestionParticle && cleaned.trim().endsWith('?')) {
      cleaned = cleaned.replace(/\?+/g, ' လား');
    } else {
      cleaned = cleaned.replace(/\?+/g, '');
    }
  }

  // 5. Filter unnecessary filler sounds
  const fillers = ['အဟမ်း', 'ဟား', 'ဟေး', 'အား', 'အို', 'ဟမ်', 'အာ', 'ဟင့်အင်း', 'ugh', 'um', 'uh', 'ah'];
  for (const filler of fillers) {
    const regex = new RegExp(`(^|\\s)${filler}(\\s|$)`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }

  // 6. Restore ASS tags
  let restored = cleaned.replace(/__ASS_TAG_(\d+)__/g, (_, idx) => assTags[parseInt(idx, 10)] || '');
  return restored.replace(/[ \t]+/g, ' ').trim();
}

// Helper validator for Burmese subtitle rules
function validateBurmeseSubtitleLine(text: string, prevLineText?: string) {
  const issues: Array<{ type: string; message: string; severity: 'error' | 'warning'; suggestion?: string }> = [];

  const textWithoutAss = text.replace(/\{[^}]+\}/g, '');

  // Check parentheses (...)
  if (/\([^)]*\)/.test(textWithoutAss) || /（[^）]*）/.test(textWithoutAss)) {
    issues.push({
      type: 'parentheses_detected',
      message: `Parentheses (...) detected with speaker name or tag. Subtitle dialogue must have parentheses cleaned.`,
      severity: 'error',
      suggestion: 'Remove parentheses and character tags',
    });
  }

  // Check brackets [...]
  if (/\[[^\]]*\]/.test(textWithoutAss) || /［[^］]*］/.test(textWithoutAss)) {
    issues.push({
      type: 'brackets_detected',
      message: `Brackets [...] detected with sound effect or description. Sound effects must be filtered out.`,
      severity: 'error',
      suggestion: 'Remove sound description brackets',
    });
  }

  // Check forbidden punctuation: ။ ၊ ? !
  const forbiddenChars = ['။', '၊', '?', '!'];
  for (const char of forbiddenChars) {
    if (text.includes(char)) {
      issues.push({
        type: 'forbidden_punctuation',
        message: `Forbidden punctuation '${char}' detected. Subtitles must use zero punctuation. Use spaces instead of commas and question particles (လား/လဲ/တုန်း/ဟင်) instead of '?'.`,
        severity: 'error',
        suggestion: char === '၊' ? 'Replace with space' : (char === '?' ? 'Use question particle (လား/လဲ)' : 'Remove'),
      });
    }
  }

  // Check literary particles
  const literaryWords = [
    { word: 'သည်', replacement: 'တယ်' },
    { word: '၏', replacement: 'ရဲ့' },
    { word: '၌', replacement: 'မှာ' },
    { word: '၎င်း', replacement: 'ဒီ/အဲဒီ' },
  ];
  for (const lit of literaryWords) {
    if (text.includes(lit.word)) {
      issues.push({
        type: 'literary_particle',
        message: `Literary word '${lit.word}' found. In spoken subtitle Burmese, use '${lit.replacement}'.`,
        severity: 'warning',
        suggestion: lit.replacement,
      });
    }
  }

  // Check consecutive 'တာ' endings
  if (text.trim().endsWith('တာ') && prevLineText && prevLineText.trim().endsWith('တာ')) {
    issues.push({
      type: 'consecutive_ta',
      message: `Consecutive lines ending with 'တာ' detected. Subtitle rule requires varied endings (တယ်၊ ပြီ၊ မယ်၊ နော်၊ ဗျာ၊ ရှင့်၊ ပေါ့).`,
      severity: 'warning',
      suggestion: 'Change ending to တယ် / ပြီ / မယ် / နော် / ပေါ့',
    });
  }

  return issues;
}

interface GenerateOptions {
  model?: string;
  contents: any;
  config?: any;
}

// Resilient Gemini generator with automatic fallback across models on 503/429/high demand
async function generateContentWithResilience(options: GenerateOptions) {
  const requested = options.model || 'gemini-3.1-flash-lite';
  // Try high-availability gemini-3.1-flash-lite first to avoid quota exhaustion, then requested, then gemini-3.8-flash
  const candidateModels = Array.from(new Set(['gemini-3.1-flash-lite', requested, 'gemini-3.8-flash']));
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const modelConfig = { ...(options.config || {}) };
      if (model.includes('flash-lite')) {
        modelConfig.thinkingConfig = {
          thinkingLevel: ThinkingLevel.MINIMAL,
        };
      } else if (model.includes('3.8')) {
        modelConfig.thinkingConfig = {
          thinkingLevel: ThinkingLevel.LOW,
        };
      } else {
        delete modelConfig.thinkingConfig;
      }

      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: modelConfig,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const errorMsg = String(err?.message || err);
      const isRecoverable =
        err?.status === 503 ||
        err?.status === 429 ||
        err?.status === 500 ||
        err?.status === 504 ||
        err?.status === 'UNAVAILABLE' ||
        err?.status === 'RESOURCE_EXHAUSTED' ||
        errorMsg.includes('503') ||
        errorMsg.includes('429') ||
        errorMsg.includes('500') ||
        errorMsg.includes('high demand') ||
        errorMsg.includes('UNAVAILABLE') ||
        errorMsg.includes('overloaded') ||
        errorMsg.includes('quota') ||
        errorMsg.includes('RESOURCE_EXHAUSTED');

      if (isRecoverable) {
        console.warn(`[AI Resilience] Model ${model} unavailable (${err?.status || errorMsg}). Trying fallback model candidate...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      throw err;
    }
  }

  // If candidate models exhausted, parse retry delay or throw descriptive error
  let retrySeconds = 20;
  try {
    const errorStr = String(lastError?.message || JSON.stringify(lastError));
    const match = errorStr.match(/retry in\s+([0-9.]+)\s*s/i) || errorStr.match(/"retryDelay":\s*"([0-9]+)s"/i);
    if (match && match[1]) {
      retrySeconds = Math.ceil(parseFloat(match[1])) || 20;
    }
  } catch (e) {
    // fallback
  }

  const isRateLimit = String(lastError?.message || '').includes('429') || lastError?.status === 429 || String(lastError?.message || '').includes('quota');
  const failureError: any = new Error(
    isRateLimit
      ? `Gemini API rate limit reached. Automatic retry scheduled in ${retrySeconds} seconds.`
      : (lastError?.message || 'AI service temporarily unavailable. Please try again.')
  );
  failureError.status = isRateLimit ? 429 : (lastError?.status || 500);
  failureError.retryAfter = retrySeconds;
  throw failureError;
}

// Repair truncated or cut-off JSON (e.g. unclosed strings or unbalanced braces)
function repairTruncatedJson(str: string): string {
  let cleaned = str.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Strategy A: Truncate back to the last completed object brace '}'
  const lastCloseBrace = cleaned.lastIndexOf('}');
  if (lastCloseBrace !== -1) {
    const candidate = cleaned.slice(0, lastCloseBrace + 1);
    let openBrackets = 0;
    let openBraces = 0;
    for (const ch of candidate) {
      if (ch === '[') openBrackets++;
      else if (ch === ']') openBrackets--;
      else if (ch === '{') openBraces++;
      else if (ch === '}') openBraces--;
    }
    let suffix = '';
    while (openBrackets > 0) {
      suffix += ']';
      openBrackets--;
    }
    while (openBraces > 0) {
      suffix += '}';
      openBraces--;
    }
    try {
      JSON.parse(candidate + suffix);
      return candidate + suffix;
    } catch {
      // Continue to Strategy B
    }
  }

  // Strategy B: Close open quotes and braces
  cleaned = cleaned.replace(/,\s*$/, '');
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (ch === '\\') {
      isEscaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ch) {
          stack.pop();
        }
      }
    }
  }

  let repaired = cleaned;
  if (isEscaped) {
    repaired = repaired.slice(0, -1);
  }
  if (inString) {
    repaired += '"';
  }
  while (stack.length > 0) {
    repaired += stack.pop();
  }
  return repaired;
}

// Regex fallback for extracting complete translation blocks if JSON is partially malformed
function extractTranslationsRegex(text: string): Array<{ id: number; burmeseText: string; ambiguityNote?: string }> {
  const translations: Array<{ id: number; burmeseText: string; ambiguityNote?: string }> = [];
  const blockMatches = text.matchAll(/\{\s*"id"\s*:\s*(\d+)[\s\S]*?"burmeseText"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
  for (const match of blockMatches) {
    const id = parseInt(match[1], 10);
    let burmeseText = match[2];
    try {
      burmeseText = JSON.parse('"' + burmeseText + '"');
    } catch {
      burmeseText = burmeseText.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    translations.push({ id, burmeseText });
  }
  return translations;
}

// Safely parse AI response handling direct JSON, truncated strings, regex extraction, and fallback
function parseAiTranslationResponse(rawText: string, expectedBlocks: any[] = []): any {
  if (!rawText || !rawText.trim()) {
    throw new Error('AI returned an empty translation response');
  }

  const cleanJson = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Attempt 1: Direct JSON parse
  try {
    const direct = JSON.parse(cleanJson);
    if (direct && Array.isArray(direct.translations)) {
      return direct;
    }
  } catch (err) {
    console.warn('[Parser] Direct JSON parse failed, attempting smart repair...', err);
  }

  // Attempt 2: Smart Truncation Repair
  try {
    const repaired = repairTruncatedJson(cleanJson);
    const parsed = JSON.parse(repaired);
    if (parsed && Array.isArray(parsed.translations) && parsed.translations.length > 0) {
      console.log(`[Parser] Successfully repaired truncated JSON with ${parsed.translations.length} translations.`);
      return parsed;
    }
  } catch (repairErr) {
    console.warn('[Parser] Smart truncation repair failed, attempting regex extraction...', repairErr);
  }

  // Attempt 3: Regex Block Extraction
  const extracted = extractTranslationsRegex(rawText);
  if (extracted.length > 0) {
    console.log(`[Parser] Extracted ${extracted.length} translations via pattern matching.`);
    return {
      translations: extracted,
      generalFeedback: 'Translated with stream recovery.',
      detectedAmbiguities: [],
    };
  }

  // Attempt 4: Root Object regex match and repair
  try {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      const repairedMatch = repairTruncatedJson(match[0]);
      const obj = JSON.parse(repairedMatch);
      if (obj && Array.isArray(obj.translations)) {
        return obj;
      }
    }
  } catch (e) {
    // continue to fallback
  }

  // Fallback: Retain original lines with auto-sanitization to avoid app-level crashes
  console.warn('[Parser] Emergency fallback activated for requested blocks.');
  return {
    translations: expectedBlocks.map((b) => ({
      id: b.id,
      burmeseText: sanitizeBurmeseSubtitleLine(b.sourceText || ''),
      ambiguityNote: 'Original text retained due to response format error',
    })),
    generalFeedback: 'Partial translation completed.',
    detectedAmbiguities: [],
  };
}

// Subtitle Translation API
app.post('/api/translate-subtitles', async (req, res) => {
  try {
    const {
      blocks,
      subtitleFormat = 'srt',
      modelProfile = 'gemini-3.8-flash',
      selectedModel = 'gemini-3.8-flash',
      sourceLanguage = 'auto_detect',
      genre = 'Action',
      characterPolicy = 'keep_english',
      pronouns = 'auto_contextual',
      formality = 'casual',
      customGlossary = [],
      customRules = [],
      additionalNotes = '',
    } = req.body;

    if (!Array.isArray(blocks) || blocks.length === 0) {
      return res.status(400).json({ error: 'Blocks array is required' });
    }

    // Determine target Gemini model from user selection
    const modelMap: Record<string, string> = {
      'gemini-3.8-flash': 'gemini-3.8-flash',
      'gemini-3.7-flash': 'gemini-3.7-flash',
      'gemini-3.1-pro-preview': 'gemini-3.1-pro-preview',
      'gemini-2.5-pro': 'gemini-2.5-pro',
      'gpt-4o': 'gemini-3.8-flash',
      'claude-3.5-sonnet': 'gemini-3.1-pro-preview',
      'llama-3.1-405b': 'gemini-3.1-pro-preview',
      'deep_context': 'gemini-3.8-flash',
      'lightning_fast': 'gemini-3.8-flash',
      'creative_colloquial': 'gemini-3.8-flash',
    };

    const targetModel = modelMap[selectedModel] || modelMap[modelProfile] || 'gemini-3.8-flash';

    let modelGuidance = `\nAI Model Engine: ${selectedModel || targetModel}`;
    if (selectedModel === 'gpt-4o') {
      modelGuidance += ' (OpenAI GPT-4o architecture mode: Ultra-fast, high-accuracy multilingual localization, snappy phrasing).';
    } else if (selectedModel === 'claude-3.5-sonnet') {
      modelGuidance += ' (Anthropic Claude 3.5 Sonnet architecture mode: Superior natural dialogue flow and human-like Burmese conversational nuance).';
    } else if (selectedModel === 'llama-3.1-405b') {
      modelGuidance += ' (Meta Llama 3.1 405B architecture mode: Deep linguistic contextualization, syntactic precision, and authentic terminology).';
    } else if (targetModel === 'gemini-3.8-flash') {
      modelGuidance += ' (Latest high-speed workhorse, superior reasoning, and multilingual context handling).';
    } else if (targetModel === 'gemini-3.7-flash') {
      modelGuidance += ' (Advanced reasoning and precise document/subtitle context understanding).';
    } else if (targetModel === 'gemini-3.1-pro-preview') {
      modelGuidance += ' (Deepest reasoning for complex cultural idioms, honorifics, and nuances).';
    } else if (targetModel === 'gemini-2.5-pro') {
      modelGuidance += ' (Stable and highly reliable long-context translation engine).';
    }

    // Multilingual translation guidance
    let languageGuidance = '';
    if (sourceLanguage === 'Japanese') {
      languageGuidance = '\nSource Language: Japanese (日本語). Accurately localize anime/drama honorifics (-san, -kun, -chan, -sama, -sensei, -senpai, dono) into natural Burmese equivalents based on character closeness and status. Translate idioms and sentence endings into natural spoken movie Burmese.';
    } else if (sourceLanguage === 'Korean') {
      languageGuidance = '\nSource Language: Korean (한국어). Accurately localize Korean relationship terms (oppa, hyung, unnie, noona, sunbae, daeponim, ajusshi) into natural spoken Burmese. Capture Kdrama emotional subtext and comedic banter.';
    } else if (sourceLanguage === 'Chinese') {
      languageGuidance = '\nSource Language: Chinese (中文). Localize Chinese familial honorifics (ge, jie, meimei, shifu, laoban) and cultural idioms into equivalent natural Burmese spoken dialogue.';
    } else if (sourceLanguage === 'English') {
      languageGuidance = '\nSource Language: English. Accurately translate colloquial idioms, sarcasm, and military/street slang into natural conversational movie Burmese.';
    } else if (sourceLanguage === 'Thai') {
      languageGuidance = '\nSource Language: Thai (ภาษาไทย). Localize respect markers (phi, nong, khun) and dramatic/comedic timing into natural spoken Burmese.';
    } else {
      languageGuidance = `\nSource Language: Multilingual (${sourceLanguage}). Accurately detect source idioms, honorifics, and nuances from foreign dialogue, translating them into authentic conversational spoken Burmese.`;
    }

    // Pronoun instructions
    let pronounInstruction = `Primary Pronoun Tone: ${pronouns}`;
    if (pronouns === 'ငါ/မင်း') {
      pronounInstruction += ' (Casual / Shonen: use ငါ for self, မင်း for other)';
    } else if (pronouns === 'ကျုပ်/ခင်ဗျား') {
      pronounInstruction += ' (Formal / Polite: use ကျုပ်/ကျွန်တော် for self, ခင်ဗျား for other)';
    } else if (pronouns === 'ကိုယ်/နင်') {
      pronounInstruction += ' (Romantic / Close: use ကိုယ် for self, နင်/မင်း for other)';
    } else if (pronouns === 'auto_contextual') {
      pronounInstruction += ' (Auto / Contextual: dynamically detect character dynamics, age, seniority, and intimacy)';
    }

    // Glossary instructions
    const glossaryInstruction = customGlossary.length > 0
      ? `\nCustom Character/Terms Glossary:\n${customGlossary.map((g: any) => `- "${g.source}" -> "${g.burmese}" (${g.note || 'term'})`).join('\n')}`
      : '';

    // Custom user rules
    const customRulesInstruction = Array.isArray(customRules) && customRules.length > 0
      ? `\nStrict User Custom Rules (MANDATORY TO FOLLOW):\n${customRules.map((r: string) => `- ${r}`).join('\n')}`
      : '';

    const isAss = subtitleFormat === 'ass';
    const formatInstruction = isAss
      ? `\nFormat Note: Input contains .ass (Advanced SubStation Alpha) subtitles. If any line contains style override tags like {\\pos(x,y)}, {\\fs24}, {\\c&H...&}, or \\N, keep those override tags and \\N line breaks completely intact in burmeseText!`
      : `\nFormat Note: Input contains standard .srt subtitles. Maintain exact 1:1 line numbers and timestamps.`;

    const promptPayload = `
Translate the following ${blocks.length} subtitle lines into natural spoken Burmese for film/series/anime.

Configuration:
- Subtitle Format: ${subtitleFormat.toUpperCase()}
- Genre Context: ${genre && genre !== 'Dynamic (Auto-Detect)' ? genre : 'Dynamic Auto-Adaptation (No Presets: analyze dialogue to automatically detect C Drama, Kdrama, Action, Comedy, Romance, Anime, etc.)'}
- Character Name Policy: ${characterPolicy} (${characterPolicy === 'keep_english' ? 'Keep English spelling' : 'Transliterate into Burmese'})
- ${pronounInstruction}
- Formality Level: ${formality}
${modelGuidance}
${languageGuidance}
${formatInstruction}
${glossaryInstruction}
${customRulesInstruction}
${additionalNotes ? `Additional Scene Notes: ${additionalNotes}` : ''}

Subtitle blocks to translate:
${JSON.stringify(blocks.map(b => ({
  id: b.id,
  startTime: b.startTime,
  endTime: b.endTime,
  sourceText: b.sourceText,
  assOverrideTags: b.assOverrideTags || undefined,
})), null, 2)}

Strictly follow all MM Channel AI Subtitles rules:
1. AUTOMATIC CLEANING & FILTERING:
   - Remove ALL character names, speaker tags, or stage directions enclosed in parentheses (...) or （...）.
   - Remove ALL sound effects, vocal descriptions, or stage actions enclosed in square brackets [...] or ［...］ (e.g. [ရယ်လျက်], [သက်ပြင်းချသံ], [Music plays], [Laughter], [Sighs]).
   - Exclude unnecessary filler vocal noises (အဟမ်း, ဟား, ဟေး, အား, um, uh, ah, ugh).
2. ZERO punctuation (NO ။, NO ၊, NO ?, NO !), use spaces for pauses, use question particles (လား/လဲ/တုန်း/ဟင်).
3. Long Sentence Auto-Splitting: If a line exceeds ~36-40 chars, split into 2 balanced lines within the same block (\n for SRT, \N for ASS).
4. Two-Speaker Separation: If 2 characters speak in the same block, format on 2 distinct lines with leading "- " for each speaker.
5. 100% Spoken Burmese (no literary words: သည်/၏/၌/၎င်း), varied endings (no consecutive 'တာ').
6. Strict 1:1 line mapping and preserve timestamps.
`;

    const response = await generateContentWithResilience({
      model: targetModel,
      contents: promptPayload,
      config: {
        systemInstruction: BURMESE_SUBTITLE_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translations: {
              type: Type.ARRAY,
              description: 'Array of translated subtitle blocks in exact 1:1 order',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  burmeseText: { type: Type.STRING, description: 'Natural spoken Burmese dialogue with ZERO punctuation' },
                  ambiguityNote: { type: Type.STRING, description: 'Optional short note if line was ambiguous or culturally adapted' },
                },
                required: ['id', 'burmeseText'],
              },
            },
            generalFeedback: {
              type: Type.STRING,
              description: 'Brief 1-sentence expert localization note about tone and character dynamics',
            },
          },
          required: ['translations'],
        },
      },
    });

    const parsed = parseAiTranslationResponse(response.text || '', blocks);

    // Ensure all requested blocks are present in translations
    const translatedList = Array.isArray(parsed.translations) ? parsed.translations : [];
    const translatedMap = new Map<number, any>(translatedList.map((t: any) => [Number(t.id), t]));

    const mergedTranslations = blocks.map((b: any, index: number) => {
      const match = translatedMap.get(Number(b.id));
      if (match && match.burmeseText) {
        return match;
      }
      return {
        id: b.id,
        startTime: b.startTime,
        endTime: b.endTime,
        burmeseText: sanitizeBurmeseSubtitleLine(b.sourceText || ''),
        ambiguityNote: 'Recovered line',
      };
    });

    // Run client-server validation & post-processing
    const translations = mergedTranslations.map((t: any, index: number, arr: any[]) => {
      // Auto-sanitize parentheses, brackets, vocal fillers, and trailing punctuation
      const cleaned = sanitizeBurmeseSubtitleLine(t.burmeseText || '');

      const prevText = index > 0 ? (arr[index - 1].burmeseText || '') : undefined;
      const issues = validateBurmeseSubtitleLine(cleaned, prevText);

      return {
        ...t,
        burmeseText: cleaned,
        issues,
      };
    });

    // Synthesize detected ambiguities from ambiguity notes or parsed array
    const detectedAmbiguities = (Array.isArray(parsed.detectedAmbiguities) && parsed.detectedAmbiguities.length > 0)
      ? parsed.detectedAmbiguities
      : translations
          .filter((t: any) => t.ambiguityNote && t.ambiguityNote.trim().length > 0)
          .map((t: any) => ({
            blockId: t.id,
            sourcePhrase: blocks.find((b: any) => b.id === t.id)?.sourceText || '',
            query: t.ambiguityNote,
            options: [t.burmeseText],
          }));

    res.json({
      success: true,
      translations,
      generalFeedback: parsed.generalFeedback || 'Translated into natural spoken Burmese.',
      detectedAmbiguities,
    });
  } catch (error: any) {
    console.error('Translation error:', error);
    const status = error.status === 429 ? 429 : 500;
    res.status(status).json({
      error: error.message || 'Failed to translate subtitles',
      isRateLimit: status === 429,
      retryAfter: error.retryAfter || 28,
    });
  }
});

// Rephrase / Alternatives API for a single line
app.post('/api/rephrase-line', async (req, res) => {
  try {
    const { sourceText, currentBurmese, genre = 'movie', pronouns = 'ငါ/မင်း' } = req.body;

    if (!sourceText) {
      return res.status(400).json({ error: 'sourceText is required' });
    }

    const prompt = `
Give 3 distinct natural spoken Burmese subtitle options for this dialogue line.
Source English: "${sourceText}"
Current Burmese translation: "${currentBurmese || 'none'}"
Genre: ${genre}
Pronouns: ${pronouns}

Remember strict subtitle rules: ZERO punctuation (no ။, no ၊, no ?, no !), use spaces for commas, use question particles (လား/လဲ/တုန်း) for questions, spoken Burmese only.

Provide 3 stylistic flavors:
1. "Casual / Street" (နေ့စဉ်ပေါ့ပေါ့ပါးပါး ပြောဟန်)
2. "Dramatic / Intense" (ရုပ်ရှင်ဇာတ်ရှိန်ပါသော ခံစားချက်ပြင်းဟန်)
3. "Polite / Respectful" (ယဉ်ကျေးသော သို့မဟုတ် ရိုသေဟန်)
`;

    const response = await generateContentWithResilience({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: BURMESE_SUBTITLE_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            alternatives: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  style: { type: Type.STRING },
                  burmeseText: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ['style', 'burmeseText', 'explanation'],
              },
            },
          },
          required: ['alternatives'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const cleanedAlternatives = (parsed.alternatives || []).map((alt: any) => ({
      ...alt,
      burmeseText: (alt.burmeseText || '')
        .replace(/[။!?]/g, '')
        .replace(/[,၊]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    }));

    res.json({ alternatives: cleanedAlternatives });
  } catch (error: any) {
    console.error('Rephrase error:', error);
    const status = error.status === 429 ? 429 : 500;
    res.status(status).json({
      error: error.message || 'Failed to rephrase line',
      isRateLimit: status === 429,
      retryAfter: error.retryAfter || 28,
    });
  }
});

// AI Localization Assistant Chat API
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], currentSrtContext = '' } = req.body;

    const chatMessages = [
      ...history.map((h: any) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }],
      })),
      {
        role: 'user',
        parts: [
          {
            text: `${currentSrtContext ? `[Current Subtitle Context / SRT Excerpt]:\n${currentSrtContext}\n\n` : ''}${message}`,
          },
        ],
      },
    ];

    const response = await generateContentWithResilience({
      model: 'gemini-3.8-flash',
      contents: chatMessages,
      config: {
        systemInstruction: BURMESE_SUBTITLE_SYSTEM_INSTRUCTION + `
When the user asks you to translate a dialogue or SRT snippet:
- Always output the translated subtitles inside a \`\`\`srt code block so they can easily copy or download it.
- Strictly uphold: zero punctuation (no ။ ၊ ? !), varied endings (no consecutive တာ), pure spoken Burmese, and 1:1 line synchronization.
- If character names are present and policy is not known, ask them whether they prefer 'keep_english' or 'burmese_transliteration'.
- If the dialogue context is ambiguous (e.g., who is talking to whom, gender, slang), ask for clarification clearly.
`,
      },
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error('Chat error:', error);
    const status = error.status === 429 ? 429 : 500;
    res.status(status).json({
      error: error.message || 'Chat request failed',
      isRateLimit: status === 429,
      retryAfter: error.retryAfter || 28,
    });
  }
});

// Setup dev server with Vite middlewares OR serve production build
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
