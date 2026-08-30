// ============================================================
// Web Speech API — Multilingual priority speech system
// Supports: en, hi, bn, ta, te, mr, as + NER fallbacks
// ============================================================

// ---- Language → BCP-47 locale map ----
export const LANG_TO_BCP47: Record<string, string> = {
  en:  'en-IN',
  hi:  'hi-IN',
  bn:  'bn-IN',
  ta:  'ta-IN',
  te:  'te-IN',
  mr:  'mr-IN',
  as:  'as-IN',
  kha: 'en-IN',  // Khasi — fallback to English
  gar: 'en-IN',  // Garo  — fallback
  miz: 'en-IN',  // Mizo  — fallback
  nag: 'en-IN',  // Nagamese — fallback
  bod: 'hi-IN',  // Bodo  — fallback to Hindi
  man: 'bn-IN',  // Manipuri — fallback to Bengali
  kok: 'bn-IN',  // Kokborok — fallback to Bengali
};

// ---- Speech priority levels ----
export const PRIORITY = {
  INFO:       0,
  NAVIGATION: 1,
  WARNING:    2,
  EMERGENCY:  3,
} as const;
type SpeechPriority = typeof PRIORITY[keyof typeof PRIORITY];

// ---- Internal state ----
let _voices: SpeechSynthesisVoice[] = [];
let _voicesLoaded = false;
let _currentPriority: SpeechPriority = -1 as SpeechPriority;
let _navDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Load voices — browsers load them asynchronously
function loadVoices(): void {
  if (!isVoiceSupported()) return;
  const v = window.speechSynthesis.getVoices();
  if (v.length > 0) { _voices = v; _voicesLoaded = true; }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    loadVoices();
  });
}

// ---- Public utils ----
export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  return _voices.length > 0 ? _voices : window.speechSynthesis?.getVoices() ?? [];
}

export function cancelSpeech(): void {
  if (!isVoiceSupported()) return;
  if (_navDebounceTimer) { clearTimeout(_navDebounceTimer); _navDebounceTimer = null; }
  window.speechSynthesis.cancel();
  _currentPriority = -1 as SpeechPriority;
}

export function getRateForSetting(setting: 'slow' | 'normal' | 'fast'): number {
  return { slow: 0.75, normal: 1.0, fast: 1.35 }[setting] ?? 1.0;
}

// ---- Voice selection ----
function selectVoice(bcp47: string, gender: 'female' | 'male'): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices();
  if (voices.length === 0) return null;

  const lang2 = bcp47.split('-')[0].toLowerCase();
  const lang3 = bcp47.toLowerCase();

  // 1. Exact locale + gender match
  const exactGender = voices.find(
    (v) =>
      v.lang.toLowerCase() === lang3 &&
      (gender === 'female'
        ? /female|woman|zira|samantha|heera|veena|lekha/i.test(v.name)
        : /male|man|david|mark|ravi/i.test(v.name))
  );
  if (exactGender) return exactGender;

  // 2. Exact locale (any gender)
  const exact = voices.find((v) => v.lang.toLowerCase() === lang3);
  if (exact) return exact;

  // 3. Base language match (hi-IN → hi)
  const base = voices.find((v) => v.lang.toLowerCase().startsWith(lang2));
  if (base) return base;

  // 4. Fallback to any en-IN voice
  return voices.find((v) => v.lang.toLowerCase().startsWith('en')) ?? null;
}

// ---- Core speak function ----
function _speakWithPriority(
  text: string,
  langCode: string,
  rate: number,
  gender: 'female' | 'male',
  priority: SpeechPriority
): void {
  if (!isVoiceSupported()) return;
  if (!text?.trim()) return;

  // Don't interrupt higher-priority speech
  if (priority < _currentPriority) return;

  window.speechSynthesis.cancel();
  _currentPriority = priority;

  const bcp47 = LANG_TO_BCP47[langCode] ?? 'en-IN';
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = bcp47;
  utterance.rate = Math.max(0.5, Math.min(2.0, rate));
  utterance.pitch = gender === 'female' ? 1.1 : 0.9;
  utterance.volume = 1.0;

  const voice = selectVoice(bcp47, gender);
  if (voice) utterance.voice = voice;

  utterance.onend = () => { _currentPriority = -1 as SpeechPriority; };
  utterance.onerror = () => { _currentPriority = -1 as SpeechPriority; };

  // Chrome quirk: cancel + speak must be separated by a tick
  setTimeout(() => window.speechSynthesis.speak(utterance), 50);
}

// ---- Public speak (general, INFO priority) ----
export function speak(
  text: string,
  langCode: string = 'en',
  rate: number = 1.0,
  gender: 'female' | 'male' = 'female'
): void {
  _speakWithPriority(text, langCode, rate, gender, PRIORITY.INFO);
}

// ---- Navigation instruction (NAVIGATION priority, debounced) ----
export function speakInstruction(
  text: string,
  langCode: string = 'en',
  rate: number = 1.0,
  gender: 'female' | 'male' = 'female'
): void {
  if (_navDebounceTimer) clearTimeout(_navDebounceTimer);
  _navDebounceTimer = setTimeout(() => {
    _navDebounceTimer = null;
    _speakWithPriority(text, langCode, rate, gender, PRIORITY.NAVIGATION);
  }, 400);
}

// ---- Disaster warning (WARNING priority) ----
export function speakDisasterWarning(
  type: string,
  locationName: string,
  langCode: string = 'en',
  rate: number = 1.0
): void {
  const text = getDisasterWarningText(type, locationName, langCode);
  _speakWithPriority(text, langCode, rate, 'female', PRIORITY.WARNING);
}

// ---- Emergency alert (EMERGENCY priority — always interrupts) ----
export function speakEmergencyAlert(
  type: string,
  locationName: string,
  langCode: string = 'en',
  rate: number = 1.0
): void {
  const text = getEmergencyAlertText(type, locationName, langCode);
  // Emergency always overrides; force cancel first
  window.speechSynthesis.cancel();
  _currentPriority = -1 as SpeechPriority;
  _speakWithPriority(text, langCode, rate, 'female', PRIORITY.EMERGENCY);
}

// ---- Emergency alert templates (14 languages) ----
function getEmergencyAlertText(type: string, location: string, lang: string): string {
  const templates: Record<string, (t: string, l: string) => string> = {
    en:  (t, l) => `Emergency alert! There is a ${t} near ${l}. Please exercise caution immediately.`,
    hi:  (t, l) => `आपातकालीन चेतावनी! ${l} के पास ${t} की सूचना है। तुरंत सावधान रहें।`,
    bn:  (t, l) => `জরুরি সতর্কতা! ${l} এর কাছে ${t} রিপোর্ট হয়েছে। সঙ্গে সঙ্গে সতর্ক থাকুন।`,
    as:  (t, l) => `জৰুৰীকালীন সতৰ্কবাৰ্তা! ${l} ৰ ওচৰত ${t} ৰিপোৰ্ট কৰা হৈছে। তৎক্ষণাৎ সাৱধান থাকক।`,
    ta:  (t, l) => `அவசர எச்சரிக்கை! ${l} அருகில் ${t} தெரிவிக்கப்பட்டுள்ளது. உடனடியாக எச்சரிக்கையாக இருங்கள்.`,
    te:  (t, l) => `అత్యవసర హెచ్చరిక! ${l} సమీపంలో ${t} నివేదించబడింది. వెంటనే జాగ్రత్తగా ఉండండి.`,
    mr:  (t, l) => `आपत्कालीन सूचना! ${l} जवळ ${t} नोंदवण्यात आले आहे. ताबडतोब सावध राहा.`,
    kha: (t, l) => `Emergency alert! There is a ${t} near ${l}. Please exercise caution.`,
    gar: (t, l) => `Emergency alert! There is a ${t} near ${l}. Please exercise caution.`,
    miz: (t, l) => `Emergency alert! ${t} in ${l}. Zirtirtu rawh.`,
    nag: (t, l) => `Emergency alert! There is a ${t} near ${l}. Be careful.`,
    bod: (t, l) => `आपातकालीन चेतावनी! ${l} के पास ${t} की सूचना है। सावधान रहें।`,
    man: (t, l) => `জরুরি সতর্কতা! ${l} এর কাছে ${t}। সতর্ক থাকুন।`,
    kok: (t, l) => `জরুরি সতর্কতা! ${l}-র কাছে ${t}। সাবধান থাকুন।`,
  };
  return (templates[lang] ?? templates.en)(type, location);
}

// ---- Disaster warning templates ----
function getDisasterWarningText(type: string, location: string, lang: string): string {
  const templates: Record<string, (t: string, l: string) => string> = {
    en:  (t, l) => `Warning! ${t} reported near ${l}. Proceed with caution.`,
    hi:  (t, l) => `चेतावनी! ${l} के पास ${t} की सूचना है। सावधानी से आगे बढ़ें।`,
    bn:  (t, l) => `সতর্কতা! ${l} এর কাছে ${t}। সাবধানে এগিয়ে যান।`,
    as:  (t, l) => `সতৰ্কতা! ${l} ৰ ওচৰত ${t}। সাৱধানে আগবাঢ়ক।`,
    ta:  (t, l) => `எச்சரிக்கை! ${l} அருகில் ${t}. கவனமாக செல்லுங்கள்.`,
    te:  (t, l) => `హెచ్చరిక! ${l} సమీపంలో ${t}. జాగ్రత్తగా వెళ్ళండి.`,
    mr:  (t, l) => `इशारा! ${l} जवळ ${t}. काळजीपूर्वक पुढे जा.`,
    kha: (t, l) => `Warning! ${t} near ${l}. Be careful.`,
    gar: (t, l) => `Warning! ${t} near ${l}. Be careful.`,
    miz: (t, l) => `Warning! ${t} in ${l}. Zirtirtu rawh.`,
    nag: (t, l) => `Warning! ${t} near ${l}. Be careful.`,
    bod: (t, l) => `चेतावनी! ${l} के पास ${t}। सावधानी से आगे बढ़ें।`,
    man: (t, l) => `সতর্কতা! ${l} এর কাছে ${t}।`,
    kok: (t, l) => `সতর্কতা! ${l}-র কাছে ${t}।`,
  };
  return (templates[lang] ?? templates.en)(type, location);
}
