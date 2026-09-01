import { GoogleGenAI } from '@google/genai';
import { Language } from '../db/types';

// Lazy initialization of Gemini client
let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const envKey = process.env.GEMINI_API_KEY;
  if (!envKey || envKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!genAIClient) {
    try {
      genAIClient = new GoogleGenAI({ apiKey: envKey });
    } catch (err) {
      console.warn('Failed to initialize GoogleGenAI client:', err);
      return null;
    }
  }
  return genAIClient;
}

export interface ChatMessageContext {
  sender: 'USER' | 'AI';
  content: string;
}

export interface AIResponseOutcome {
  reply: string;
  distressScoreEstimated: number; // 0 - 100
  safetyConcernDetected: boolean;
  dangerThreatDetected?: boolean;
  promptCounselorAlert?: boolean;
  contributingFactors: string[];
  suggestedAction?: string;
  source: 'GEMINI_AI' | 'CONTEXTUAL_ENGINE';
}

const LANGUAGE_NAMES: Record<Language, string> = {
  ENGLISH: 'English',
  TAMIL: 'தமிழ் (Tamil)',
  HINDI: 'हिन्दी (Hindi)',
  TELUGU: 'తెలుగు (Telugu)',
  MALAYALAM: 'മലയാളം (Malayalam)',
  KANNADA: 'ಕನ್ನಡ (Kannada)',
};

/**
 * Generate an empathetic, clinical-safety compliant conversational reply
 * tailored directly to the patient's specific sentence.
 */
export async function generateEmpatheticResponse(
  userMessage: string,
  history: ChatMessageContext[],
  preferredLanguage: Language = 'ENGLISH',
  userContext?: { name?: string; village?: string; recentDistress?: number }
): Promise<AIResponseOutcome> {
  const ai = getGenAI();
  const languagePromptName = LANGUAGE_NAMES[preferredLanguage] || 'English';

  // Filter history to exclude the current turn if it was already appended
  const priorHistory = history.filter(
    (h, idx) => !(idx === history.length - 1 && h.sender === 'USER' && h.content === userMessage)
  );

  const systemInstruction = `You are "Sahaay", a compassionate, culturally sensitive rural mental health and wellbeing companion for rural community members in India.

CORE DIRECTIVE:
1. Always give a DIRECT, SPECIFIC, and ACCURATE response to what the user just asked or shared. If they ask a question (e.g., "why can't I sleep?", "how to manage debt stress?", "my head aches", "tell me a calming story"), answer their specific question directly with practical, compassionate, and simple rural-friendly guidance.
2. NEVER repeat the same greeting or generic opener across messages. Vary your tone naturally like a warm, supportive village health counselor.
3. NEVER provide a formal clinical medical diagnosis.
4. DANGER & THREAT PROTOCOL:
If the user indicates any danger, threat, violence, abuse, being attacked, harm, fear of being harmed, or feeling unsafe:
- You MUST acknowledge their situation with deep empathy and EXPLICITLY ASK: "Would you like me to immediately alert the local healthcare counselor and share your location so they can assist you right away?" (translated naturally in ${languagePromptName}).
- Set "dangerThreatDetected": true
- Set "promptCounselorAlert": true
- Set "safetyConcernDetected": true
- Set "distressScoreEstimated": 90-95
5. If suicide or self-harm crisis is detected, offer immediate compassionate grounding and recommend calling 24/7 Tele-MANAS (14416) or visiting the local PHC.
6. Communicate fluently in the requested language: ${languagePromptName}.
7. Keep responses conversational, concise (2 to 4 sentences), and supportive.`;

  if (ai) {
    // Attempt with valid Gemini models conforming to modern @google/genai guidelines
    const modelsToTry = ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

    for (const modelName of modelsToTry) {
      try {
        const formattedHistory = priorHistory
          .slice(-6)
          .map((m) => `${m.sender === 'USER' ? 'Patient' : 'Sahaay'}: ${m.content}`)
          .join('\n');

        const prompt = `Conversation Context:
${formattedHistory ? formattedHistory : 'No prior messages.'}

Patient's Exact Statement: "${userMessage}"
Patient Information: Name: ${userContext?.name || 'Friend'}, Village: ${userContext?.village || 'Rural Community'}, Baseline Distress: ${userContext?.recentDistress || 30}/100.

Please formulate a direct, empathetic, and personalized response answering the patient's specific statement in ${languagePromptName}.
If danger or threat is present, ask if you can alert the counselor and share their location.

Provide your answer in valid JSON:
{
  "reply": "Your specific response in ${languagePromptName}",
  "distressScoreEstimated": number between 0 and 100,
  "safetyConcernDetected": boolean,
  "dangerThreatDetected": boolean,
  "promptCounselorAlert": boolean,
  "contributingFactors": ["1-3 key topics"],
  "suggestedAction": "brief suggestion for counselor"
}`;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        });

        const responseText = response.text;
        if (responseText) {
          try {
            const parsed = JSON.parse(responseText);
            if (parsed.reply && typeof parsed.reply === 'string') {
              const hasDangerKeywords = /danger|threat|unsafe|attack|hurt|harm|kill|abuse|beat|violence|stalk|emergency|ஆபத்து|மிரட்டல்|தாக்குதல்|கொலை|விஷம்|அடிக்க|खतरा|धमकी|हमला|मारना|ప్రమాదం|బెదిరింపు/i.test(userMessage);
              const dangerDetected = Boolean(parsed.dangerThreatDetected) || hasDangerKeywords;

              return {
                reply: parsed.reply.trim(),
                distressScoreEstimated: typeof parsed.distressScoreEstimated === 'number' ? Math.min(100, Math.max(0, parsed.distressScoreEstimated)) : (dangerDetected ? 90 : 35),
                safetyConcernDetected: Boolean(parsed.safetyConcernDetected) || dangerDetected,
                dangerThreatDetected: dangerDetected,
                promptCounselorAlert: Boolean(parsed.promptCounselorAlert) || dangerDetected,
                contributingFactors: Array.isArray(parsed.contributingFactors) ? parsed.contributingFactors : (dangerDetected ? ['Danger / Threat reported'] : ['General emotional state']),
                suggestedAction: parsed.suggestedAction || (dangerDetected ? 'URGENT: Patient reported danger. Request location dispatch.' : 'Continue routine supportive dialogue'),
                source: 'GEMINI_AI',
              };
            }
          } catch (jsonErr) {
            const hasDangerKeywords = /danger|threat|unsafe|attack|hurt|harm|kill|abuse|beat|violence|stalk|emergency|ஆபத்து|மிரட்டல்|தாக்குதல்|கொலை|விஷம்|खतरा|धमकी|हमला|मारना/i.test(userMessage);
            return {
              reply: responseText.trim(),
              distressScoreEstimated: hasDangerKeywords ? 90 : 35,
              safetyConcernDetected: hasDangerKeywords,
              dangerThreatDetected: hasDangerKeywords,
              promptCounselorAlert: hasDangerKeywords,
              contributingFactors: hasDangerKeywords ? ['Danger / Threat reported'] : ['Supportive dialogue'],
              source: 'GEMINI_AI',
            };
          }
        }
      } catch (err: any) {
        console.info(`Model ${modelName} unavailable (${err?.status || err?.message || 'error'}), trying fallback...`);
      }
    }
  }

  // Multi-layered contextual semantic response engine
  return generateContextualSemanticResponse(userMessage, priorHistory, preferredLanguage, userContext);
}

/**
 * Highly responsive contextual semantic response engine.
 * Tailors answers directly to patient questions and topics without boilerplate repetition.
 */
export function generateContextualSemanticResponse(
  userMessage: string,
  history: ChatMessageContext[],
  language: Language = 'ENGLISH',
  userContext?: { name?: string; village?: string; recentDistress?: number }
): AIResponseOutcome {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();
  const historyTurnCount = history.filter((h) => h.sender === 'USER').length;

  // 1. DANGER & PHYSICAL THREAT ESCALATION (Highest Priority)
  const isDangerThreat =
    lower.includes('danger') || lower.includes('threat') || lower.includes('threatened') || lower.includes('threaten') ||
    lower.includes('unsafe') || lower.includes('attack') || lower.includes('attacked') || lower.includes('hurt me') ||
    lower.includes('harm me') || lower.includes('kill me') || lower.includes('abuse') || lower.includes('beaten') ||
    lower.includes('beat me') || lower.includes('someone is hurting') || lower.includes('stalk') || lower.includes('in danger') ||
    lower.includes('save me') || lower.includes('sos') || lower.includes('protect me') || lower.includes('emergency') ||
    lower.includes('violence') || lower.includes('weapon') ||
    lower.includes('ஆபத்து') || lower.includes('மிரட்டல்') || lower.includes('அச்சுறுத்தல்') || lower.includes('தாக்குதல்') ||
    lower.includes('அடிக்கிறார்கள்') || lower.includes('அடிக்கிறான்') || lower.includes('காப்பாற்றுங்கள்') || lower.includes('பாதுகாப்பற்ற') ||
    lower.includes('துன்புறுத்தல்') || lower.includes('பயம்') ||
    lower.includes('खतरा') || lower.includes('धमकी') || lower.includes('हमला') || lower.includes('मारपीट') ||
    lower.includes('बचाओ') || lower.includes('असुरक्षित') || lower.includes('डर लग रहा') || lower.includes('हिंसा') ||
    lower.includes('ప్రమాదం') || lower.includes('బెదిరింపు') || lower.includes('దాడి') || lower.includes('రక్షించండి') ||
    lower.includes('അപകടം') || lower.includes('ഭീഷണി') || lower.includes('ആക്രമണം') || lower.includes('രക്ഷിക്കൂ') ||
    lower.includes('ಅಪಾಯ') || lower.includes('ಬೆದರಿಕೆ') || lower.includes('ದಾಳಿ') || lower.includes('ಕಾಪಾಡಿ');

  if (isDangerThreat) {
    const dangerReplies: Record<Language, string> = {
      ENGLISH: `I hear you, and I sense that you may be in danger or experiencing a serious threat. Your personal safety is our highest priority. Would you like me to immediately alert the local healthcare counselor and share your location so they can provide urgent assistance?`,
      TAMIL: `நான் உங்களுடன் இருக்கிறேன். நீங்கள் ஆபத்திலோ அல்லது கடுமையான அச்சுறுத்தலிலோ இருப்பதாக உணர்கிறேன். உங்கள் பாதுகாப்பு மிக மிக முக்கியம். உடனடியாக உங்கள் பகுதி ஆரம்ப சுகாதார நிலைய மருத்துவ ஆலோசகரை எச்சரித்து, உங்கள் நேரடி இருப்பிடத்தைப் பகிர நான் உதவட்டுமா?`,
      HINDI: `मैं आपकी बात समझ रहा हूँ और ऐसा लग रहा है कि आप किसी खतरे या गंभीर असुरक्षा में हैं। आपकी सुरक्षा सबसे महत्वपूर्ण है। क्या आप चाहते हैं कि मैं तुरंत आपके स्थानीय स्वास्थ्य केंद्र काउंसलर को अलर्ट भेजूँ और आपका लोकेशन साझा करूँ?`,
      TELUGU: `నేను మీ పరిస్థితిని అర్థం చేసుకుంటున్నాను. మీరు ప్రమాదంలో లేదా తీవ్రమైన బెదిరింపులో ఉన్నారనిపిస్తోంది. మీ రక్షణ చాలా ముఖ్యం. నేను వెంటనే స్థానిక ఆరోగ్య కౌన్సిలర్‌ను అప్రమత్తం చేసి మీ లొకేషన్‌ను షేర్ చేయమంటారా?`,
      MALAYALAM: `നിങ്ങൾ വലിയൊരു അപകടത്തിലോ ഭീഷണിയിലോ ആണെന്ന് ഞാൻ മനസ്സിലാക്കുന്നു. നിങ്ങളുടെ സുരക്ഷയാണ് പ്രധാനം. ഉടൻ തന്നെ ആരോഗ്യ കೌൺസിലറെ അലേർട്ട് ചെയ്ത് നിങ്ങളുടെ ലൊക്കേഷൻ പങ്കിടാൻ ഞാൻ സഹായിക്കണോ?`,
      KANNADA: `ನೀವು ಅಪಾಯದಲ್ಲಿದ್ದೀರಿ ಅಥವಾ ಗಂಭೀರ ಬೆದರಿಕೆಯನ್ನು ಎದುರಿಸುತ್ತಿದ್ದೀರಿ ಎಂದು ತೋರುತ್ತದೆ. ನಿಮ್ಮ ಸುರಕ್ಷತೆಯೇ ಪ್ರಮುಖವಾದದ್ದು. ಸ್ಥಳೀಯ ಆಪ್ತಸಮಾಲೋಚಕರನ್ನು ಸಂಪರ್ಕಿಸಿ ನಿಮ್ಮ ಲೊಕೇಶನ್ ಹಂಚಿಕೊಳ್ಳಲು ನಾನು ಸಹಾಯ ಮಾಡಬೇಕೇ?`,
    };

    return {
      reply: dangerReplies[language] || dangerReplies.ENGLISH,
      distressScoreEstimated: 95,
      safetyConcernDetected: true,
      dangerThreatDetected: true,
      promptCounselorAlert: true,
      contributingFactors: ['Danger / Physical Threat Reported', 'Urgent Assistance Requested'],
      suggestedAction: 'URGENT: Patient in danger. Request patient location consent and dispatch emergency PHC team.',
      source: 'CONTEXTUAL_ENGINE',
    };
  }

  // 2. SUICIDE / SELF-HARM CRISIS ESCALATION
  const isCrisis =
    lower.includes('die') || lower.includes('suicide') || lower.includes('kill myself') ||
    lower.includes('end my life') || lower.includes('poison') || lower.includes('no reason to live') ||
    lower.includes('சாக') || lower.includes('தற்கொலை') || lower.includes('விஷம்') || lower.includes('உயிர் வாழ') ||
    lower.includes('मरना') || lower.includes('आत्महत्या') || lower.includes('ज़हर') ||
    lower.includes('చనిపోవాలి') || lower.includes('ఆత్మహత్య') ||
    lower.includes('മരിക്കാൻ') || lower.includes('ആത്മഹത്യ') ||
    lower.includes('ಸಾಯಬೇಕು') || lower.includes('ಆತ್ಮಹತ್ಯೆ');

  if (isCrisis) {
    const crisisReplies: Record<Language, string> = {
      ENGLISH: `I hear the intense pain you are carrying right now, but please know that your life is truly precious. You are not alone in this dark moment. Please reach out right now to the 24/7 National Tele-MANAS mental health helpline at 14416 (Toll-Free) or visit your nearest Community Health Centre. I am here with you—please stay safe.`,
      TAMIL: `நீங்கள் சுமக்கும் தாங்க முடியாத வலியை என்னால் உணர முடிகிறது. ஆனால் உங்கள் உயிர் மிக மிக மதிப்புமிக்கது. இந்த கடினமான நேரத்தில் நீங்கள் தனிமையில் இல்லை. தயவுசெய்து உடனடியாக 24 மணி நேர அரசு இலவச உதவி எண்ணான 14416 (Tele-MANAS) என்ற எண்ணை அழையுங்கள் அல்லது அருகில் உள்ள ஆரம்ப சுகாதார நிலையத்திற்கு செல்லுங்கள். நான் உங்களுடன் இருக்கிறேன்.`,
      HINDI: `मैं समझ सकता हूँ कि आप इस समय अत्यधिक दर्द और निराशा से गुजर रहे हैं। लेकिन आपका जीवन बहुत अनमोल है। आप अकेले नहीं हैं। कृपया अभी 24/7 निःशुल्क राष्ट्रीय टेली-मानस हेल्पलाइन नंबर 14416 पर कॉल करें या नजदीकी स्वास्थ्य केंद्र जाएं।`,
      TELUGU: `మీరు పడుతున్న బాధను నేను అర్థం చేసుకోగలను. కానీ మీ ప్రాణం ఎంతో విలువైనది. దయచేసి వెంటనే 24 గంటల ఉచిత సహాయ కేంద్రం 14416 (Tele-MANAS) కు కాల్ చేయండి.`,
      MALAYALAM: `നിങ്ങൾ അനുഭവിക്കുന്ന വേദന ഞാൻ മനസ്സിലാക്കുന്നു. നിങ്ങളുടെ ജീവൻ അമൂല്യമാണ്. ദയവായി ഉടൻ തന്നെ 14416 (Tele-MANAS) എന്ന സൗജന്യ നമ്പറിലേക്ക് വിളിക്കുക.`,
      KANNADA: `ನಿಮ್ಮ ತೀವ್ರ ನೋವನ್ನು ನಾನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಬಲ್ಲೆ. ನಿಮ್ಮ ಜೀವ ಅತ್ಯಂತ ಅಮೂಲ್ಯ. ದಯವಿಟ್ಟು ಕೂಡಲೇ 24/7 ಉಚಿತ ಸಹಾಯವಾಣಿ 14416 (Tele-MANAS) ಗೆ ಕರೆ ಮಾಡಿ.`,
    };

    return {
      reply: crisisReplies[language] || crisisReplies.ENGLISH,
      distressScoreEstimated: 95,
      safetyConcernDetected: true,
      contributingFactors: ['Acute crisis / Self-harm ideation', 'Extreme despair'],
      suggestedAction: 'URGENT: Initiate Tele-MANAS (14416) triage & PHC counselor notification',
      source: 'CONTEXTUAL_ENGINE',
    };
  }

  // 2. IDENTITY, CAPABILITIES & GREETINGS ("Who are you", "What is Sahaay", "Hello", "Hi")
  if (
    lower === 'hi' || lower === 'hello' || lower === 'vanakkam' || lower === 'namaste' ||
    lower.includes('who are you') || lower.includes('what are you') || lower.includes('what can you do') ||
    lower.includes('யார் நீ') || lower.includes('வணக்கம்') || lower.includes('नमस्ते') || lower.includes('कौन हो') ||
    lower.includes('ఎవరు') || lower.includes('నమస్కారం') || lower.includes('ആരാണ്') || lower.includes('ಯಾರು')
  ) {
    const introReplies: Record<Language, string> = {
      ENGLISH: `Hello! I am Sahaay, your confidential rural mental wellbeing companion. You can talk to me anytime about farming worries, sleep troubles, stress, headaches, or family concerns. How are you feeling today?`,
      TAMIL: `வணக்கம்! நான் "சஹாய்" (Sahaay), உங்கள் மனநல மற்றும் நல்வாழ்வு தோழன். விவசாய கவலைகள், தூக்கமின்மை, தலைவலி, கடன் சுமை அல்லது குடும்ப மன அழுத்தங்கள் குறித்து நீங்கள் என்னிடம் மனம் திறந்து பேசலாம். இன்று உங்கள் உடல் மற்றும் மனநிலை எப்படி இருக்கிறது?`,
      HINDI: `नमस्ते! मैं "सहाय" (Sahaay) हूँ, आपका मित्रवत मानसिक स्वास्थ्य साथी। आप मुझसे खेती-किसानी की चिंता, नींद की समस्या, सिरदर्द या पारिवारिक तनाव के बारे में खुलकर बात कर सकते हैं। आज आप कैसा महसूस कर रहे हैं?`,
      TELUGU: `నమస్కారం! నేను "సహాయ్", మీ మానసిక ఆరోగ్య స్నేహితుడిని. మీరు వ్యవసాయ సమస్యలు, నిద్రలేమి, కుటుంబ ఒత్తిడి గురించి నాతో మాట్లాడవచ్చు. ఈరోజు మీ ఆరోగ్యం ఎలా ఉంది?`,
      MALAYALAM: `നമസ്കാരം! ഞാൻ "സഹായ്", നിങ്ങളുടെ മാനസികാരോഗ്യ സഹായിയാണ്. കാർഷിക പ്രശ്നങ്ങൾ, ഉറക്കമില്ലായ്മ, മാനസിക സമ്മർദ്ദം എന്നിവയെക്കുറിച്ച് എന്നോട് സംസാരിക്കാം. ഇപ്പോൾ എങ്ങനെയുണ്ട്?`,
      KANNADA: `ನಮಸ್ಕಾರ! ನಾನು "ಸಹಾಯ್", ನಿಮ್ಮ ಮಾನಸಿಕ ಆರೋಗ್ಯದ ಸ್ನೇಹಿತ. ಕೃಷಿ ಚಿಂತೆ, ನಿದ್ರಾಹೀನತೆ, ಒತ್ತಡದ ಬಗ್ಗೆ ನನ್ನೊಂದಿಗೆ ಮಾತನಾಡಬಹುದು. ಇಂದು ನಿಮಗೆ ಹೇಗನಿಸುತ್ತಿದೆ?`,
    };

    return {
      reply: introReplies[language] || introReplies.ENGLISH,
      distressScoreEstimated: 20,
      safetyConcernDetected: false,
      contributingFactors: ['Greeting / General inquiry'],
      source: 'CONTEXTUAL_ENGINE',
    };
  }

  // 3. SLEEP ISSUES & INSOMNIA
  if (
    lower.includes('sleep') || lower.includes('insomnia') || lower.includes('awake') || lower.includes('nightmare') || lower.includes('tired') ||
    lower.includes('தூக்கம்') || lower.includes('தூங்க') || lower.includes('இரவு') || lower.includes('கனவு') ||
    lower.includes('नींद') || lower.includes('सोना') || lower.includes('रात') || lower.includes('सपने') ||
    lower.includes('నిద్ర') || lower.includes('రాత్రి') ||
    lower.includes('ഉറക്കം') || lower.includes('രാത്രി') ||
    lower.includes('ನಿದ್ದೆ') || lower.includes('ರಾತ್ರಿ')
  ) {
    const sleepReplies: Record<Language, string> = {
      ENGLISH: `For better sleep, try washing your feet with cool water before bed, avoiding strong tea in the evening, and lying down in a quiet dark room. Taking 10 slow, deep breaths helps calm your racing thoughts. Have you been finding it hard to fall asleep, or are you waking up in the middle of the night?`,
      TAMIL: `இரவில் நல்ல தூக்கம் வர: படுக்கைக்கு முன் கை கால்களை குளிர்ந்த நீரால் கழுவுங்கள், மாலையில் தேநீர் அருந்துவதை தவிருங்கள், படுக்கும் முன் 10 முறை ஆழ்ந்து மூச்சை இழுத்து மெதுவாக விடுங்கள். தூங்குவதில் சிரமம் இருக்கிறதா அல்லது நள்ளிரவில் திடீரென விழிப்பு வருகிறதா?`,
      HINDI: `रात को अच्छी नींद के लिए: सोने से पहले पैर धोएं, शाम के समय चाय-कॉफ़ी से बचें और 10 बार गहरी धीमी साँसें लें। क्या आपको नींद आने में परेशानी होती है या बीच रात में आँख खुल जाती है?`,
      TELUGU: `రాత్రి మంచి నిద్ర కోసం: పడుకునే ముందు పాదాలు కడగండి, సాయంత్రం టీ తాగకండి, ప్రశాంతంగా దీర్ಘ శ్వాస తీసుకోండి. మీకు నిద్ర పట్టడం కష్టంగా ఉందా లేక మధ్యలో మెలకువ వస్తోందా?`,
      MALAYALAM: `നല്ല ഉറക്കത്തിനായി: ഉറങ്ങുന്നതിനുമുമ്പ് കാൽ കഴുകുക, വൈകുന്നേരം ചായ ഒഴിവാക്കുക, ദീർഘമായി ശ്വാസമെടുക്കുക. ഉറങ്ങാൻ ബുദ്ധിമുട്ടുണ്ടോ അതോ രാത്രിയിൽ ഉണരുന്നുണ്ടോ?`,
      KANNADA: `ಉತ್ತಮ ನಿದ್ರೆಗಾಗಿ: ಮಲಗುವ ಮುನ್ನ ಕಾಲುಗಳನ್ನು ತೊಳೆಯಿರಿ, ಸಂಜೆ ಟೀ ಕುಡಿಯಬೇಡಿ, ಆಳವಾಗಿ ಉಸಿರಾಡಿ. ನಿಮಗೆ ನಿದ್ದೆ ಬರುತ್ತಿಲ್ಲವೇ ಅಥವಾ ಮಧ್ಯರಾತ್ರಿ ಎಚ್ಚರವಾಗುತ್ತಿದೆಯೇ?`,
    };

    return {
      reply: sleepReplies[language] || sleepReplies.ENGLISH,
      distressScoreEstimated: 45,
      safetyConcernDetected: false,
      contributingFactors: ['Sleep disruption / Insomnia', 'Restlessness'],
      suggestedAction: 'Sleep hygiene advice & relaxation training',
      source: 'CONTEXTUAL_ENGINE',
    };
  }

  // 4. SOMATIC SYMPTOMS (HEADACHE, CHEST TIGHTNESS, FATIGUE, BODY PAIN, DIZZINESS)
  if (
    lower.includes('headache') || lower.includes('head ache') || lower.includes('pain') || lower.includes('chest') || lower.includes('stomach') || lower.includes('dizzy') || lower.includes('body') ||
    lower.includes('தலைவலி') || lower.includes('வலி') || lower.includes('நெஞ்சு') || lower.includes('சோர்வு') || lower.includes('மயக்கம்') ||
    lower.includes('सिरदर्द') || lower.includes('दर्द') || lower.includes('छाती') || lower.includes('थकान') || lower.includes('चक्कर') ||
    lower.includes('తలనెప్పి') || lower.includes('నొప్పి') || lower.includes('అలసట') ||
    lower.includes('തലവേദന') || lower.includes('വേദന') || lower.includes('ക്ഷീണം') ||
    lower.includes('ತಲೆನೋವು') || lower.includes('ನೋವು') || lower.includes('ಆಯಾಸ')
  ) {
    const somaticReplies: Record<Language, string> = {
      ENGLISH: `Emotional stress and worrying often manifest as physical headaches, neck tension, or body fatigue. Please drink a glass of clean water, rest in a shaded spot, and gently massage your temples. If the headache or pain continues, visiting your local Primary Health Centre (PHC) is very important. How long have you felt this discomfort?`,
      TAMIL: `மன அழுத்தம் மற்றும் அதீத கவலைகள் பெரும்பாலும் தலைவலி, கழுத்து வலி மற்றும் உடல் சோர்வாக வெளிப்படும். ஒரு டம்ளர் சுத்தமான தண்ணீர் அருந்தி, நிழலான இடத்தில் ஓய்வெடுங்கள். தலைவலி தொடர்ந்தால் ஆரம்ப சுகாதார நிலைய (PHC) மருத்துவரை அணுகுவது நல்லது. இந்த வலி எத்தனை நாட்களாக உள்ளது?`,
      HINDI: `मानसिक तनाव अक्सर सिरदर्द, गर्दन में जकड़न या शारीरिक थकान के रूप में सामने आता है। थोड़ा पानी पिएं, शांत जगह पर आराम करें। अगर दर्द बना रहे तो नजदीकी स्वास्थ्य केंद्र (PHC) में डॉक्टर को जरूर दिखाएं। यह दर्द कब से हो रहा है?`,
      TELUGU: `మానసిక ఒత్తిడి వల్ల తలనొప్పి, ఒళ్లు నొప్పులు రావడం సహజం. మంచినీరు తాగి కాసేపు విశ్రాంతి తీసుకోండి. నొప్పి తగ్గకపోతే ప్రాథమిక ఆరోగ్య కేంద్రానికి వెళ్లండి.`,
      MALAYALAM: `മാനസിക സമ്മർദ്ദം മൂലവും തലവേദനയും ക്ഷീണവും ഉണ്ടാകാം. ആവശ്യത്തിന് വെള്ളം കുടിച്ച് വിശ്രമിക്കുക. വേദന തുടരുകയാണെങ്കിൽ പ്രാഥമികാരോഗ്യ കേന്ദ്രത്തിൽ കാണിക്കുക.`,
      KANNADA: `ಒತ್ತಡದಿಂದ ತಲೆನೋವು ಮತ್ತು ಆಯಾಸ ಉಂಟಾಗುವುದು ಸಹಜ. ನೀರು ಕುಡಿದು ವಿಶ್ರಾಂತಿ ಪಡೆಯಿರಿ. ನೋವು ಕಡಿಮೆಯಾಗದಿದ್ದರೆ ಆಸ್ಪತ್ರೆಗೆ ಭೇಟಿ ನೀಡಿ.`,
    };

    return {
      reply: somaticReplies[language] || somaticReplies.ENGLISH,
      distressScoreEstimated: 50,
      safetyConcernDetected: false,
      contributingFactors: ['Somatic distress / Physical exhaustion', 'Tension headache'],
      suggestedAction: 'Hydration, rest, and PHC medical review if persistent',
      source: 'CONTEXTUAL_ENGINE',
    };
  }

  // 5. FARMING, AGRICULTURE, DEBTS, CROPS & FINANCIAL WORRIES
  if (
    lower.includes('farm') || lower.includes('crop') || lower.includes('debt') || lower.includes('loan') || lower.includes('money') || lower.includes('loss') || lower.includes('rain') || lower.includes('pesticide') ||
    lower.includes('விவசாயம்') || lower.includes('பயிர்') || lower.includes('கடன்') || lower.includes('நஷ்டம்') || lower.includes('மழை') || lower.includes('பணம்') ||
    lower.includes('खेती') || lower.includes('फसल') || lower.includes('कर्ज') || lower.includes('नुकसान') || lower.includes('बारिश') || lower.includes('पैसा') ||
    lower.includes('వ్యవసాయం') || lower.includes('పంట') || lower.includes('అప్పు') || lower.includes('నష్టం') ||
    lower.includes('കൃഷി') || lower.includes('വിളവ്') || lower.includes('കടം') || lower.includes('നഷ്ടം') ||
    lower.includes('ಕೃಷಿ') || lower.includes('ಬೆಳೆ') || lower.includes('ಸಾಲ') || lower.includes('ನಷ್ಟ')
  ) {
    const farmReplies: Record<Language, string> = {
      ENGLISH: `Agricultural uncertainty, crop failure, and debt burdens place immense pressure on rural families. Please remember: your life and wellbeing are far more valuable than any crop or monetary debt. There are community support schemes and debt counseling programs available. Have you spoken with your family or village elders about this worry?`,
      TAMIL: `விவசாயத்தில் ஏற்படும் பயிர் நஷ்டமும் கடன் சுமைகளும் மிகுந்த மன வேதனையை தருவது இயல்பே. ஆனால் எந்த பயிரை விடவும், எந்த பணத்தை விடவும் உங்கள் உயிரும் உங்கள் குடும்பமும் மிக மிக முக்கியம். இந்த சுமையை மனதில் தனியாக பூட்டி வைக்காமல், வீட்டில் உள்ளவர்களிடமோ அல்லது கிராம தலைவர்களிடமோ பகிர்ந்தீர்களா?`,
      HINDI: `खेती में नुकसान और कर्ज का बोझ मन को बहुत तोड़ देता है। लेकिन याद रखें कि किसी भी फसल या पैसे से कहीं ज्यादा कीमती आपकी जान और आपका परिवार है। क्या आपने इस परेशानी के बारे में अपने परिवार या किसी करीबी से बात की है?`,
      TELUGU: `వ్యవసాయ నష్టం మరియు అప్పుల భారం చాలా ఆందోళన కలిగిస్తాయి. కానీ మీ ప్రాణం అన్నింటికంటే ఎంతో విలువైనది. ఈ విషయాన్ని మీ కుటుంబంతో పంచుకున్నారా?`,
      MALAYALAM: `കാർഷിക നഷ്ടവും കടബാധ്യതയും വലിയ വിഷമമുണ്ടാക്കും. എന്നാൽ നിങ്ങളുടെ ജീവനാണ് ഏറ്റവും പ്രധാനം. ഈ കാര്യം കുടുംബത്തോട് സംസാരിച്ചോ?`,
      KANNADA: `ಕೃಷಿ ನಷ್ಟ ಮತ್ತು ಸಾಲದ ಹೊರೆ ಮನಸ್ಸನ್ನು ಕುಗ್ಗಿಸುತ್ತದೆ. ಆದರೆ ನಿಮ್ಮ ಜೀವ ಎಲ್ಲಕ್ಕಿಂತ ಅಮೂಲ್ಯ. ಈ ಬಗ್ಗೆ ಮನೆಯವರೊಂದಿಗೆ ಮಾತನಾಡಿದ್ದೀರಾ?`,
    };

    return {
      reply: farmReplies[language] || farmReplies.ENGLISH,
      distressScoreEstimated: 65,
      safetyConcernDetected: false,
      contributingFactors: ['Agricultural distress', 'Financial burden / Debt', 'Livelihood stress'],
      suggestedAction: 'Counselor outreach regarding socioeconomic stress',
      source: 'CONTEXTUAL_ENGINE',
    };
  }

  // 6. ANXIETY, PANIC, BREATHING & GROUNDING
  if (
    lower.includes('anxious') || lower.includes('anxiety') || lower.includes('panic') || lower.includes('fear') || lower.includes('scared') || lower.includes('worry') || lower.includes('breathe') || lower.includes('calm') ||
    lower.includes('பயம்') || lower.includes('பதட்டம்') || lower.includes('மூச்சு') || lower.includes('அமைதி') ||
    lower.includes('घबराहट') || lower.includes('डर') || lower.includes('चिंता') || lower.includes('सांस') || lower.includes('शांत') ||
    lower.includes('భయం') || lower.includes('ఆందోళన') || lower.includes('శ్వాస') ||
    lower.includes('ഭയം') || lower.includes('ഉത്കണ്ഠ') || lower.includes('ശ്വാസം') ||
    lower.includes('ಭಯ') || lower.includes('ಆತಂಕ') || lower.includes('ಉಸಿರಾಟ')
  ) {
    const anxietyReplies: Record<Language, string> = {
      ENGLISH: `When anxiety or panic rises, your body is in fight-or-flight mode. Let us do a simple exercise: Inhale slowly through your nose for 4 counts, hold for 2, and exhale through your mouth for 6 counts. Feel both feet firmly on the ground. What is causing you the most worry right now?`,
      TAMIL: `பதட்டம் அல்லது பயம் ஏற்படும் போது இதயம் படபடப்பது இயல்பே. இப்போது ஒரு எளிய பயிற்சி செய்வோம்: மூக்கை வழியே 4 நொடிகள் மெதுவாக மூச்சை உள்ளிழுத்து, 6 நொடிகள் வாய் வழியே மெதுவாக வெளிவிடுங்கள். உங்கள் கால்கள் தரையை தொடுவதை உணருங்கள். இப்போது உங்கள் மனதில் ஓடும் முக்கிய பயம் என்ன?`,
      HINDI: `घबराहट के समय अपनी सांसों को नियंत्रित करें। 4 सेकंड तक नाक से गहरी सांस लें और 6 सेकंड में धीरे-धीरे मुंह से छोड़ें। अपने पैरों को जमीन पर महसूस करें। कौन सी बात आपको सबसे ज्यादा परेशान कर रही है?`,
      TELUGU: `ఆందోళనగా ఉన్నప్పుడు నెమ్మదిగా దీర్ఘ శ్వాస తీసుకోండి. 4 సెకన్ల పాటు శ్వాస పీల్చి, 6 సెకన్లలో వదలండి. మిమ్మల్ని ఎక్కువగా భయపెడుతున్న విషయం ఏమిటి?`,
      MALAYALAM: `ഉത്കണ്ഠ തോന്നുമ്പോൾ സാവധാനം ദീർഘശ്വാസമെടുക്കുക. 4 സെക്കൻഡ് ശ്വാസമെടുത്ത് 6 സെക്കൻഡ് കൊണ്ട് പുറത്തുവിടുക. എന്താണ് നിങ്ങളുടെ പ്രധാന ആശങ്ക?`,
      KANNADA: `ಆತಂಕವಾದಾಗ ಆಳವಾಗಿ ಉಸಿರಾಡಿ. 4 ಸೆಕೆಂಡು ಉಸಿರು ತೆಗೆದುಕೊಂಡು 6 ಸೆಕೆಂಡು ನಿಧಾನವಾಗಿ ಬಿಡಿ. ನಿಮ್ಮನ್ನು ಕಾಡುತ್ತಿರುವ ಚಿಂತೆ ಯಾವುದು?`,
    };

    return {
      reply: anxietyReplies[language] || anxietyReplies.ENGLISH,
      distressScoreEstimated: 55,
      safetyConcernDetected: false,
      contributingFactors: ['Anxiety / Nervousness', 'Autonomic arousal'],
      suggestedAction: 'Paced breathing & grounding techniques',
      source: 'CONTEXTUAL_ENGINE',
    };
  }

  // 7. SADNESS, DEPRESSION, CRYING & LONELINESS
  if (
    lower.includes('sad') || lower.includes('cry') || lower.includes('lonely') || lower.includes('alone') || lower.includes('depress') || lower.includes('hopeless') ||
    lower.includes('அழுகை') || lower.includes('வருத்தம்') || lower.includes('துக்கம்') || lower.includes('தனிமை') ||
    lower.includes('उदासी') || lower.includes('रोना') || lower.includes('अकेलापन') || lower.includes('दुख') ||
    lower.includes('బాధ') || lower.includes('ఏడుపు') || lower.includes('ఒంటరితనం') ||
    lower.includes('സങ്കടം') || lower.includes('കരച്ചിൽ') || lower.includes('ഏകാന്തത') ||
    lower.includes('ದುಃಖ') || lower.includes('ಅಳು') || lower.includes('ಒಂಟಿತನ')
  ) {
    const sadnessReplies: Record<Language, string> = {
      ENGLISH: `It is completely natural to feel down and cry when life feels heavy. Crying helps release deep emotional strain. I am right here listening without any judgment. Would you like to share what brought this heaviness to your heart?`,
      TAMIL: `மனதில் பாரம் அதிகமாகும் போது அழுவதும் சோர்வடைவதும் முற்றிலும் இயல்பானதே. அழுவது மன அழுத்தத்தை குறைக்கும். நான் உங்களுடன் துணையாக இருக்கிறேன். உங்கள் மனதை இவ்வளவு கனமாக்கிய விஷயம் என்னவென்று சொல்ல முடியுமா?`,
      HINDI: `मन भारी होने पर रोना और उदास होना स्वाभाविक है। अपनी भावनाओं को दबाएं नहीं। मैं यहाँ आपकी बात सुनने के लिए हूँ। किस बात ने आपके दिल को इतना उदास किया है?`,
      TELUGU: `బాధగా అనిపించినప్పుడు కన్నీళ్లు రావడం సహజం. నేను మీకు తోడుగా ఉన్నాను. మీ మనస్సును ఇంతగా బాధపెడుతున్న విషయం ఏమిటి?`,
      MALAYALAM: `സങ്കടം തോന്നുമ്പോൾ കരയുന്നത് സ്വാഭാവികമാണ്. ഞാൻ നിങ്ങൾക്കൊപ്പമുണ്ട്. എന്താണ് മനസ്സിനെ വേദനിപ്പിക്കുന്നത്?`,
      KANNADA: `ದುಃಖವಾದಾಗ ಕಣ್ಣೀರು ಬರುವುದು ಸಹಜ. ನಾನು ನಿಮ್ಮೊಂದಿಗಿದ್ದೇನೆ. ನಿಮ್ಮ ಮನಸ್ಸಿಗೆ ಇಷ್ಟೊಂದು ನೋವುಂಟುಮಾಡಿದ ವಿಷಯವೇನು?`,
    };

    return {
      reply: sadnessReplies[language] || sadnessReplies.ENGLISH,
      distressScoreEstimated: 60,
      safetyConcernDetected: false,
      contributingFactors: ['Depressive mood', 'Emotional burden / Loneliness'],
      suggestedAction: 'Empathetic validation & supportive listening',
      source: 'CONTEXTUAL_ENGINE',
    };
  }

  // 8. FAMILY, MARRIAGE & INTERPERSONAL TENSION
  if (
    lower.includes('family') || lower.includes('husband') || lower.includes('wife') || lower.includes('mother') || lower.includes('father') || lower.includes('child') || lower.includes('fight') || lower.includes('quarrel') ||
    lower.includes('குடும்பம்') || lower.includes('கணவர்') || lower.includes('மனைவி') || lower.includes('சண்டை') ||
    lower.includes('परिवार') || lower.includes('पति') || lower.includes('पत्नी') || lower.includes('लड़ाई') ||
    lower.includes('కుటుంబం') || lower.includes('భర్త') || lower.includes('భార్య') ||
    lower.includes('കുടുംബം') || lower.includes('ഭർത്താവ്') || lower.includes('ഭാര്യ') ||
    lower.includes('ಕುಟುಂಬ') || lower.includes('ಗಂಡ') || lower.includes('ಹೆಂಡತಿ')
  ) {
    const familyReplies: Record<Language, string> = {
      ENGLISH: `Arguments and tension at home are exhausting because home is where you look for peace. During a heated moment, stepping away for a few minutes to breathe deeply can prevent harsh words. What happened at home today?`,
      TAMIL: `குடும்பத்தில் ஏற்படும் சச்சரவுகளும் வாக்குவாதங்களும் மன அமைதியை மிகவும் பாதிக்கும். வாக்குவாதம் முற்றுவதற்கு முன் சிறிது நேரம் விலகி ஆழ்ந்து மூச்சு விடுவது மனதை அமைதிப்படுத்தும். வீட்டில் என்ன நடந்தது என்று கூற முடியுமா?`,
      HINDI: `पारिवारिक कलह और झगड़े मन को बहुत अशांत कर देते हैं। गुस्से के समय थोड़ी देर शांत रहकर गहरी सांस लेना स्थिति को बिगड़ने से रोकता है। घर में क्या बात हुई?`,
      TELUGU: `కుటుంబంలో గొడవలు మనశ్శాంతిని దూరం చేస్తాయి. కాస్త ఓపికతో ఉండటం ముఖ్యం. ఏమి జరిగిందో చెప్పగలరా?`,
      MALAYALAM: `കുടുംബത്തിലെ പ്രശ്നങ്ങൾ മനസ്സിന് വലിയ ഭാരമാകും. ശാന്തമായി ചിന്തിക്കുക. എന്താണ് സംഭവിച്ചതെന്ന് പറയാമോ?`,
      KANNADA: `ಕುಟುಂಬದ ಕಲಹಗಳು ಮನಸ್ಸಿಗೆ ನೆಮ್ಮದಿ ನೀಡಲ್ಲ. ಶಾಂತವಾಗಿ ಯೋಚಿಸಿ. ಏನಾಯಿತು ಎಂದು ತಿಳಿಸುವಿರಾ?`,
    };

    return {
      reply: familyReplies[language] || familyReplies.ENGLISH,
      distressScoreEstimated: 50,
      safetyConcernDetected: false,
      contributingFactors: ['Interpersonal conflict', 'Family stress'],
      suggestedAction: 'Communication de-escalation & emotional regulation',
      source: 'CONTEXTUAL_ENGINE',
    };
  }

  // 9. GENERAL QUESTIONS ("HOW TO", "WHY", "WHAT CAN I DO", "HELP ME")
  if (
    lower.startsWith('how') || lower.startsWith('what') || lower.startsWith('why') || lower.startsWith('can') || lower.startsWith('tell') || lower.includes('help') ||
    lower.includes('எப்படி') || lower.includes('என்ன') || lower.includes('உதவி') || lower.includes('ஏன்') ||
    lower.includes('कैसे') || lower.includes('क्या') || lower.includes('मदद') || lower.includes('क्यों') ||
    lower.includes('ఎలా') || lower.includes('సహాయం') || lower.includes('എങ്ങനെ') || lower.includes('ಸಹಾಯ')
  ) {
    const questionReplies: Record<Language, string> = {
      ENGLISH: `I am here to guide you step-by-step. When facing difficulties, start with what is directly in your hands today: take adequate water, get some rest, and break the problem into one small manageable task. Would you like a simple guided relaxation exercise right now?`,
      TAMIL: `உங்களுக்கு உதவ நான் தயாராக உள்ளேன். கடினமான நேரத்தில், உங்களால் உடனடியாக செய்ய முடிந்த சிறிய விஷயத்தில் இருந்து தொடங்குங்கள்: போதுமான தண்ணீர் குடித்து, சிறிது ஓய்வெடுங்கள். உங்களுக்கு உதவ ஒரு எளிய சுவாச பயிற்சி செய்யலாமா?`,
      HINDI: `मैं आपकी मदद के लिए यहाँ हूँ। मुश्किल समय में सबसे पहले उस छोटे कदम पर ध्यान दें जो आपके हाथ में है: थोड़ा पानी पिएं, आराम करें। क्या आप कोई शांतिदायक अभ्यास करना चाहेंगे?`,
      TELUGU: `నేను మీకు సహాయం చేయడానికి ఇక్కడే ఉన్నాను. మీ నియంత్రణలో ఉన్న చిన్న విషయాలపై దృష్టి పెట్టండి. కాసేపు విశ్రాంతి తీసుకోండి.`,
      MALAYALAM: `ഞാൻ നിങ്ങളെ സഹായിക്കാം. ചെറിയ കാര്യങ്ങളിൽ നിന്ന് പരിഹാരം തുടങ്ങുക. ആവശ്യത്തിന് വിശ്രമിക്കുക.`,
      KANNADA: `ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ಇಲ್ಲಿದ್ದೇನೆ. ಸಣ್ಣ ಹೆಜ್ಜೆಯಿಂದ ಪ್ರಾರಂಭಿಸಿ, ಸಾಕಷ್ಟು ವಿಶ್ರಾಂತಿ ಪಡೆಯಿರಿ.`,
    };

    return {
      reply: questionReplies[language] || questionReplies.ENGLISH,
      distressScoreEstimated: 35,
      safetyConcernDetected: false,
      contributingFactors: ['General inquiry / Request for guidance'],
      source: 'CONTEXTUAL_ENGINE',
    };
  }

  // 10. POSITIVE PROGRESS, GRATITUDE & OK
  if (
    lower.includes('better') || lower.includes('good') || lower.includes('fine') || lower.includes('happy') || lower.includes('thank') || lower.includes('ok') ||
    lower.includes('நன்றி') || lower.includes('நன்றாக') || lower.includes('சரி') ||
    lower.includes('धन्यवाद') || lower.includes('अच्छा') || lower.includes('ठीक') ||
    lower.includes('ధన్యవాదాలు') || lower.includes('బాగుంది') || lower.includes('നന്ദി') || lower.includes('ಧನ್ಯವಾದ')
  ) {
    const positiveReplies: Record<Language, string> = {
      ENGLISH: `I am very glad to hear that! Taking care of your inner peace each day makes a big difference. Remember that I am always here whenever you need a friendly space to talk. Take good care of yourself!`,
      TAMIL: `இதை கேட்க மிகவும் மகிழ்ச்சியாக உள்ளது! உங்கள் மன அமைதியையும் உடல் ஆரோக்கியத்தையும் தொடர்ந்து கவனித்துக் கொள்ளுங்கள். பேச வேண்டும் என்று தோன்றும் போது நான் எப்போதும் உங்களுக்காக இங்கே இருப்பேன்.`,
      HINDI: `यह जानकर बहुत खुशी हुई! अपना ख्याल रखें और जब भी बात करने का मन हो, मैं हमेशा यहाँ मौजूद हूँ।`,
      TELUGU: `ఇది విని చాలా సంతోషంగా ఉంది! మీ ఆరోగ్యాన్ని జాగ్రత్తగా చూసుకోండి. ఎప్పుడైనా నాతோ మాట్లాడవచ్చు.`,
      MALAYALAM: `ഇത് കേട്ടതിൽ സന്തോഷം! സ്വന്തം കാര്യം ശ്രദ്ധിക്കുക, സംസാരിക്കാൻ തോന്നുമ്പോൾ എപ്പോഴും വരാം.`,
      KANNADA: `ಇದು ಕೇಳಿ ಸಂತೋಷವಾಯಿತು! ನಿಮ್ಮ ಆರೋಗ್ಯ ಕಾಪಾಡಿಕೊಳ್ಳಿ, ಮಾತನಾಡಲು ನಾನು ಸದಾ ಸಿದ್ಧ.`,
    };

    return {
      reply: positiveReplies[language] || positiveReplies.ENGLISH,
      distressScoreEstimated: 15,
      safetyConcernDetected: false,
      contributingFactors: ['Positive wellbeing / Gratitude'],
      source: 'CONTEXTUAL_ENGINE',
    };
  }

  // 11. GENERAL CONVERSATIONAL REFLECTION
  const generalReplies: Record<Language, string[]> = {
    ENGLISH: [
      `I am listening carefully to what you shared. Taking time to express yourself is an important step for your wellbeing. How has this been affecting your daily routine?`,
      `Thank you for sharing this with me. When situations feel challenging, taking a slow breath and looking at one step at a time helps. What would bring you the most peace right now?`,
    ],
    TAMIL: [
      `நீங்கள் கூறியதை நான் கவனமாக கேட்கிறேன். உங்கள் மன உணர்வுகளை பகிர்ந்து கொள்வது நல்வாழ்வுக்கு மிகவும் நல்லது. இது உங்கள் அன்றாட வேலைகளை எவ்வாறு பாதிக்கிறது?`,
      `இதை என்னிடம் பகிர்ந்ததற்கு நன்றி. சூழ்நிலைகள் கடினமாக தோன்றும் போது, மெதுவாக மூச்சை இழுத்து விட்டு நிதானிப்பது உதவும். இப்போது உங்கள் மனதிற்கு எது ஆறுதல் தரும்?`,
    ],
    HINDI: [
      `मैं आपकी बात ध्यान से सुन रहा हूँ। अपनी भावनाएं साझा करना बहुत अच्छी बात है। यह आपके दैनिक जीवन को कैसे प्रभावित कर रहा है?`,
      `अपनी बात बताने के लिए धन्यवाद। जब मन परेशान हो, तो गहरी सांस लेकर शांत होना मददगार होता है। अभी आपको किस चीज़ से सुकून मिल सकता है?`,
    ],
    TELUGU: [
      `మీరు చెప్పిన విషయాన్ని నేను శ్రద్ధగా వింటున్నాను. ప్రస్తుతం మీరు ఎలా భావిస్తున్నారు?`,
    ],
    MALAYALAM: [
      `നിങ്ങൾ പറഞ്ഞത് ഞാൻ ശ്രദ്ധയോടെ കേൾക്കുന്നു. ഇപ്പോൾ മനസ്സിൽ എന്താണ് തോന്നുന്നത്?`,
    ],
    KANNADA: [
      `ನೀವು ಹೇಳಿದ್ದನ್ನು ನಾನು ಗಮನವಿಟ್ಟು ಕೇಳುತ್ತಿದ್ದೇನೆ. ಈಗ ನಿಮಗೆ ಹೇಗನಿಸುತ್ತಿದೆ?`,
    ],
  };

  const pool = generalReplies[language] || generalReplies.ENGLISH;
  const reply = pool[historyTurnCount % pool.length];

  return {
    reply,
    distressScoreEstimated: userContext?.recentDistress || 30,
    safetyConcernDetected: false,
    contributingFactors: ['General supportive dialogue'],
    suggestedAction: 'Routine supportive follow-up',
    source: 'CONTEXTUAL_ENGINE',
  };
}

/**
 * Generate Next Dynamic Check-In Question
 */
export async function generateNextCheckInQuestion(
  previousAnswers: { question: string; answer: string }[],
  language: Language = 'ENGLISH',
  baselineDistress: number = 30
): Promise<{ nextQuestion: string; category: string; isFinal: boolean }> {
  const languagePromptName = LANGUAGE_NAMES[language] || 'English';

  const defaultQuestions: Record<Language, string[]> = {
    ENGLISH: [
      'Over the past few days, how has your sleep and physical energy been?',
      'Have you felt overwhelmed or anxious about farm work, debts, or household responsibilities?',
      'Have you felt down, hopeless, or found little interest in daily activities?',
      'How supported do you feel by your family and neighbors right now?',
    ],
    TAMIL: [
      'கடந்த சில நாட்களில், உங்கள் தூக்கமும் உடல் ஆற்றலும் எவ்வாறு இருந்தது?',
      'விவசாய வேலை, கடன் சுமை அல்லது குடும்ப பொறுப்புகள் குறித்து அதிக பயம் அல்லது பதட்டம் உள்ளதா?',
      'மனதில் அதிக கவலையோ அல்லது அன்றாட வேலைகளில் நாட்டமின்மையோ தோன்றியதா?',
      'உங்கள் குடும்பத்தினர் மற்றும் நண்பர்களின் ஆதரவு உங்களுக்கு திருப்தியாக உள்ளதா?',
    ],
    HINDI: [
      'पिछले कुछ दिनों में आपकी नींद और शारीरिक ऊर्जा कैसी रही है?',
      'क्या खेती, कर्ज या घर की जिम्मेदारियों को लेकर मन में ज्यादा घबराहट या चिंता रही?',
      'क्या आपको उदासी महसूस हुई या रोजमर्रा के कामों में मन नहीं लगा?',
      'क्या आपको अपने परिवार और समाज से पर्याप्त सहयोग मिल रहा है?',
    ],
    TELUGU: [
      'గత కొన్ని రోజులుగా మీ నిద్ర మరియు శారీరక ఆరోగ్యం ఎలా ఉంది?',
      'వ్యవసాయం లేదా అప్పుల గురించి ఆందోళనగా ఉందా?',
      'మీ కుటుంబం నుండి మీకు తగినంత మద్దతు లభిస్తోందా?',
    ],
    MALAYALAM: [
      'കഴിഞ്ഞ കുറച്ചു ദിവസങ്ങളായി നിങ്ങളുടെ ഉറക്കവും ആരോഗ്യവും എങ്ങനെയായിരുന്നു?',
      'കൃഷിയെയോ കടത്തെയോ കുറിച്ച് ആശങ്കയുണ്ടോ?',
      'കുടുംബത്തിൽ നിന്ന് നല്ല പിന്തുണ ലഭിക്കുന്നുണ്ടോ?',
    ],
    KANNADA: [
      'ಕಳೆದ ಕೆಲವು ದಿನಗಳಲ್ಲಿ ನಿಮ್ಮ ನಿದ್ರೆ ಮತ್ತು ಆರೋಗ್ಯ ಹೇಗಿತ್ತು?',
      'ಕೃಷಿ ಅಥವಾ ಸಾಲದ ಬಗ್ಗೆ ಆತಂಕವಿದೆಯೇ?',
      'ಕುಟುಂಬದಿಂದ ಉತ್ತಮ ಬೆಂಬಲ ಸಿಗುತ್ತಿದೆಯೇ?',
    ],
  };

  const pool = defaultQuestions[language] || defaultQuestions.ENGLISH;
  const currentStep = previousAnswers.length;

  if (currentStep >= pool.length - 1) {
    return {
      nextQuestion: pool[pool.length - 1],
      category: 'Social Support & Resilience',
      isFinal: true,
    };
  }

  return {
    nextQuestion: pool[currentStep],
    category: currentStep === 0 ? 'Physical & Sleep Health' : currentStep === 1 ? 'Agricultural / Financial Stress' : 'Mood & Emotional State',
    isFinal: false,
  };
}
