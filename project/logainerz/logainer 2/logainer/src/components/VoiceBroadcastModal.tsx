import React, { useState, useEffect } from 'react';
import { 
  X, 
  Volume2, 
  Radio, 
  Sparkles, 
  Languages, 
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useLanguage, LANGUAGES, LanguageCode } from '../context/LanguageContext';
import { useLogistics } from '../context/LogisticsContext';

interface VoiceBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MULTILINGUAL_PRESETS: Record<string, Array<{ title: string; text: string }>> = {
  en: [
    {
      title: 'Sonapur Tunnel Blockage Alert',
      text: 'Attention Convoy Drivers: Sonapur Tunnel on National Highway 6 is completely blocked due to heavy mudflow. Please take the Umrangso-Haflong green corridor bypass.'
    },
    {
      title: 'Sela Pass Black Ice Warning',
      text: 'Warning for Tawang Corridor: Sela Pass is experiencing severe black ice and blizzard conditions. Tire chains are strictly mandatory. Maintain 25 km/h.'
    },
    {
      title: 'Pagla Pahar Rockfall Advisory',
      text: 'Advisory for Dimapur-Kohima NH-29: Active boulder rockfall at Pagla Pahar. Traffic paced in single lane by Border Roads Organisation.'
    },
    {
      title: 'Medical Oxygen Priority Escort',
      text: 'Emergency Green Corridor cleared for Cryogenic Oxygen tankers moving from Guwahati to Silchar. NDRF escort active.'
    }
  ],
  ta: [
    {
      title: 'சோனாபூர் சுரங்கப்பாதை அடைப்பு எச்சரிக்கை',
      text: 'ஓட்டுநர்கள் கவனத்திற்கு: தேசிய நெடுஞ்சாலை 6-ல் உள்ள சோனாபூர் சுரங்கப்பாதை கடுமையான சேற்றுப்பாய்வு காரணமாக முழுமையாக அடைக்கப்பட்டுள்ளது. தயவுசெய்து உம்ராங்சோ-ஹாஃப்லாங் மாற்றுப்பாதையைப் பயன்படுத்தவும்.'
    },
    {
      title: 'சேலா கணவாய் பனி எச்சரிக்கை',
      text: 'தவாங் வழித்தடத்திற்கான எச்சரிக்கை: சேலா கணவாயில் கடுமையான பனிப்புயல் நிலவுகிறது. டயர் சங்கிலிகள் கட்டாயம். மணிக்கு 25 கி.மீ வேகத்தை பராமரிக்கவும்.'
    },
    {
      title: 'பாக்லா பஹார் பாறைச்சரிவு எச்சரிக்கை',
      text: 'திமாபூர்-கோஹிமா தேசிய நெடுஞ்சாலை 29: பாக்லா பஹாரில் தீவிர பாறைச்சரிவு. எல்லைப்புற சாலைகள் அமைப்பால் போக்குவரத்து ஒற்றை வழியில் கட்டுப்படுத்தப்படுகிறது.'
    },
    {
      title: 'மருத்துவ ஆக்ஸிஜன் அவசர பாதுகாப்பு',
      text: 'குவஹாத்தியில் இருந்து சில்சார் செல்லும் திரவ ஆக்ஸிஜன் டேங்கர்களுக்கு அவசரகால பசுமை வழித்தடம் அனுமதிக்கப்பட்டுள்ளது. என்.டி.ஆர்.எஃப் பாதுகாப்பு செயலில் உள்ளது.'
    }
  ],
  te: [
    {
      title: 'సోనాపూర్ టన్నెల్ బ్లాకేజ్ హెచ్చరిక',
      text: 'డ్రైవర్ల గమనిక: భారీ బురద ప్రవాహం కారణంగా నేషనల్ హైవే 6 పై సోనాపూర్ టన్నెల్ పూర్తిగా మూసివేయబడింది. దయచేసి ఉమ్రాంగ్సో-హాఫ్లాంగ్ బైపాస్ మార్గాన్ని ఉపయోగించండి.'
    },
    {
      title: 'సేలా పాస్ మంచు ప్రమాద హెచ్చరిక',
      text: 'తవాంగ్ కారిడార్ హెచ్చరిక: సేలా పాస్ వద్ద తీవ్రమైన మంచు తుఫాను ఉంది. టైర్ గొలుసులు తప్పనిసరి. గంటకు 25 కిమీ వేగాన్ని పాటించండి.'
    },
    {
      title: 'పాగ్లా పహార్ కొండచరియల హెచ్చరిక',
      text: 'దిమాపూర్-కోహిమా NH-29: పాగ్లా పహార్ వద్ద బండరాళ్లు పడుతున్నాయి. సరిహద్దు రోడ్ల సంస్థ ట్రాఫిక్‌ను క్రమబద్ధీకరిస్తోంది.'
    },
    {
      title: 'వైద్య ఆక్సిజన్ అత్యవసర ఎస్కార్ట్',
      text: 'గువహాటి నుండి సిల్చార్ వెళ్లే ఆక్సిజన్ ట్యాంకర్ల కోసం అత్యవసర గ్రీన్ కారిడార్ క్లియర్ చేయబడింది. NDRF ఎస్కార్ట్ యాక్టివ్‌గా ఉంది.'
    }
  ],
  kn: [
    {
      title: 'ಸೋನಾಪುರ ಸುರಂಗ ರಸ್ತೆ ತಡೆ ಎಚ್ಚರಿಕೆ',
      text: 'ವಾಹನ ಚಾಲಕರ ಗಮನಕ್ಕೆ: ರಾಷ್ಟ್ರೀಯ ಹೆದ್ದಾರಿ 6 ರಲ್ಲಿ ಸೋನಾಪುರ ಸುರಂಗವು ಭಾರಿ ಮಣ್ಣಿನ ಕುಸಿತದಿಂದಾಗಿ ಸಂಪೂರ್ಣವಾಗಿ ಬಂದ್ ಆಗಿದೆ. ದಯವಿಟ್ಟು ಉಮ್ರಾಂಗ್ಸೋ-ಹಾಫ್ಲಾಂಗ್ ಬೈಪಾಸ್ ಬಳಸಿ.'
    },
    {
      title: 'ಸೇಲಾ ಪಾಸ್ ಹಿಮಪಾತ ಎಚ್ಚರಿಕೆ',
      text: 'ತವಾಂಗ್ ಮಾರ್ಗಕ್ಕೆ ಎಚ್ಚರಿಕೆ: ಸೇಲಾ ಪಾಸ್‌ನಲ್ಲಿ ತೀವ್ರ ಹಿಮಪಾತವಿದೆ. ಟೈರ್ ಸರಪಳಿಗಳು ಕಡ್ಡಾಯ. ಗಂಟೆಗೆ 25 ಕಿಮೀ ವೇಗ ಕಾಪಾಡಿಕೊಳ್ಳಿ.'
    },
    {
      title: 'ವೈದ್ಯಕೀಯ ಆಕ್ಸಿಜನ್ ತುರ್ತು ಕಾರಿಡಾರ್',
      text: 'ಗುವಾಹಾಟಿ-ಸಿಲ್ಚಾರ್ ಆಕ್ಸಿಜನ್ ಟ್ಯಾಂಕರ್‌ಗಳಿಗೆ ತುರ್ತು ಗ್ರೀನ್ ಕಾರಿಡಾರ್ ತೆರವುಗೊಳಿಸಲಾಗಿದೆ. NDRF ಬೆಂಗಾವಲು ಸಕ್ರಿಯವಾಗಿದೆ.'
    }
  ],
  ml: [
    {
      title: 'സോനാപൂർ ടണൽ തടസ്സ മുന്നറിയിപ്പ്',
      text: 'ഡ്രൈവർമാരുടെ ശ്രദ്ധയ്ക്ക്: ദേശീയപാത 6 ലെ സോനാപൂർ ടണൽ കനത്ത മണ്ണിടിച്ചിൽ കാരണം പൂർണ്ണമായും അടച്ചിരിക്കുന്നു. ഉമ്രാംഗ്സോ-ഹാഫ്ലോംഗ് ബൈപാസ് ഉപയോഗിക്കുക.'
    },
    {
      title: 'സേലാ പാസ് മഞ്ഞ് മുന്നറിയിപ്പ്',
      text: 'തവാങ് പാതയ്ക്കുള്ള മുന്നറിയിപ്പ്: സേലാ പാസിൽ കടുത്ത മഞ്ഞുവീഴ്ചയുണ്ട്. ടയർ ചെയിനുകൾ നിർബന്ധമാണ്.'
    },
    {
      title: 'മെഡിക്കൽ ഓക്സിജൻ എമർജൻസി എസ്കോർട്ട്',
      text: 'ഗുവാഹത്തിയിൽ നിന്ന് സിൽച്ചാറിലേക്കുള്ള ഓക്സിജൻ ടാങ്കറുകൾക്കായി ഗ്രീൻ കോറിഡോർ സജ്ജമാക്കി. NDRF സുരക്ഷ നിലവിലുണ്ട്.'
    }
  ],
  mr: [
    {
      title: 'सोनापूर बोगदा मार्ग ब्लॉक इशारा',
      text: 'चालकांसाठी सूचना: राष्ट्रीय महामार्ग ६ वरील सोनापूर बोगदा दरड कोसळल्यामुळे पूर्णपणे बंद आहे. कृपया उमरांगसो-हाफलॉंग बायपास वापरा.'
    },
    {
      title: 'सेला पास बर्फवृष्टी इशारा',
      text: 'तवांग महामार्गासाठी इशारा: सेला पासवर तीव्र बर्फवृष्टी सुरू आहे. टायर चेन अनिवार्य आहेत.'
    },
    {
      title: 'वैद्यकीय ऑक्सिजन ग्रीन कॉरिडोअर',
      text: 'गुवाहाटी ते सिलचर ऑक्सिजन टँकरसाठी आपत्कालीन ग्रीन कॉरिडोअर सुरू करण्यात आला आहे. NDRF एस्कॉर्ट तैनात आहे.'
    }
  ],
  hi: [
    {
      title: 'सोनापुर सुरंग अवरोध चेतावनी',
      text: 'चालक ध्यान दें: राष्ट्रीय राजमार्ग 6 पर सोनापुर सुरंग भारी मलबे के कारण पूरी तरह बंद है। कृपया उमरांगसो-हाफलोंग वैकल्पिक ग्रीन कॉरिडोर मार्ग का उपयोग करें।'
    },
    {
      title: 'सेला पास बर्फबारी व फिसलन चेतावनी',
      text: 'तवांग कॉरिडोर चेतावनी: सेला दर्रे पर भारी बर्फबारी और फिसलन की स्थिति है। टायर चेन अनिवार्य है। वाहन की गति 25 किमी/घंटा बनाए रखें।'
    },
    {
      title: 'पगला पहाड़ भूस्खलन एडवाइजरी',
      text: 'दीमापुर-कोहिमा एनएच-29: पगला पहाड़ पर पत्थरों का गिरना जारी है। बीआरओ द्वारा सिंगल लेन में यातायात नियंत्रित किया जा रहा है।'
    },
    {
      title: 'मेडिकल ऑक्सीजन आपातकालीन ग्रीन कॉरिडोर',
      text: 'गुवाहाटी से सिलचर जाने वाले ऑक्सीजन टैंकरों के लिए आपातकालीन ग्रीन कॉरिडोर चालू है। एनडीआरएफ एस्कॉर्ट सक्रिय है।'
    }
  ],
  bn: [
    {
      title: 'সোনাপুর টানেল অবরুদ্ধ সতর্কতা',
      text: 'চালকদের অবগতির জন্য: জাতীয় সড়ক ৬-এর সোনাপুর টানেল ভূমিধসের কারণে সম্পূর্ণ বন্ধ। দয়া করে উমরাংসো-হাফলং বিকল্প পথ ব্যবহার করুন।'
    },
    {
      title: 'সেলা পাস তুষারপাত সতর্কতা',
      text: 'তাওয়াং করিডোরের জন্য সতর্কতা: সেলা পাসে তীব্র তুষারঝড় চলছে। টায়ার চেইন বাধ্যতামূলক। গতিবেগ ঘণ্টায় ২৫ কিমি রাখুন।'
    },
    {
      title: 'মেডিকেল অক্সিজেন জরুরি এসকর্ট',
      text: 'গুয়াহাটি থেকে শিলচরগামী অক্সিজেন ট্যাঙ্কারের জন্য গ্রিন করিডোর খালি করা হয়েছে। এনডিআরএফ এসকর্ট সক্রিয়।'
    }
  ],
  as: [
    {
      title: 'সোণাপুৰ সুৰংগ পথ বন্ধৰ সতৰ্কবাৰ্তা',
      text: 'চালকসকলৰ দৃষ্টি আকৰ্ষণ কৰা হৈছে: ৬ নং ৰাষ্ট্ৰীয় ঘাইপথৰ সোণাপুৰ সুৰংগ ভূমিস্খলনৰ বাবে সম্পূৰ্ণ বন্ধ। অনুগ্ৰহ কৰি উমৰাংছ\'-হাফলং বিকল্প পথ লওক।'
    },
    {
      title: 'চেলা পাছ তুষাৰপাত সতৰ্কতা',
      text: 'টাৱাং পথৰ বাবে সতৰ্কবাৰ্তা: চেলা পাছত বৰফ আৰু কুঁৱলীৰ প্ৰকোপ বাঢ়িছে। টায়াৰত চেইন লগোৱা বাধ্যতামূলক।'
    },
    {
      title: 'চিকিৎসা অক্সিজেন জৰুৰী এচকৰ্ট',
      text: 'গুৱাহাটীৰ পৰা শিলচৰলৈ অক্সিজেন টেংকাৰৰ বাবে জৰুৰী গ্ৰীণ কৰিডৰ সক্ৰিয় কৰা হৈছে।'
    }
  ]
};

export const VoiceBroadcastModal: React.FC<VoiceBroadcastModalProps> = ({ isOpen, onClose }) => {
  const { language, setLanguage, speakAlert } = useLanguage();
  const { chokepoints, addToast } = useLogistics();

  const currentPresets = MULTILINGUAL_PRESETS[language] || MULTILINGUAL_PRESETS['en'];

  const [customText, setCustomText] = useState(currentPresets[0]?.text || '');

  useEffect(() => {
    const presets = MULTILINGUAL_PRESETS[language] || MULTILINGUAL_PRESETS['en'];
    if (presets && presets[0]) {
      setCustomText(presets[0].text);
    }
  }, [language]);

  if (!isOpen) return null;

  const handleSpeak = (textToSpeak: string) => {
    speakAlert(textToSpeak);
    addToast('SUCCESS', 'Voice Broadcast Dispatched', `Audio alert synthesized in ${language.toUpperCase()} voice profile.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl glass-panel-glow p-6 shadow-2xl border border-cyan-500/30 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Volume2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Multilingual Voice Alert Broadcaster</h3>
              <p className="text-xs text-slate-400">
                Text-to-Speech audio synthesizer for truck drivers in low-visibility mountain passes
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center space-x-1.5">
            <Languages className="w-3.5 h-3.5 text-cyan-400" />
            <span>Select Broadcast Language:</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1 rounded-xl bg-slate-950/40 border border-white/5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all border ${
                  language === lang.code
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-glow-cyan'
                    : 'bg-slate-900/60 text-slate-400 border-white/5 hover:border-white/20'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.nativeName}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Preset Announcements */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Translated Dispatch Presets ({language.toUpperCase()}):
          </label>
          <div className="space-y-2">
            {currentPresets.map((preset, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setCustomText(preset.text);
                  handleSpeak(preset.text);
                }}
                className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/40 cursor-pointer text-xs transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-white group-hover:text-cyan-300">{preset.title}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-1">{preset.text}</div>
                </div>
                <Volume2 className="w-4 h-4 text-cyan-400 shrink-0 ml-2 group-hover:scale-110" />
              </div>
            ))}
          </div>
        </div>

        {/* Custom Textarea */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Custom Audio Broadcast:</label>
          <textarea
            rows={3}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Speak Button */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
          >
            Close
          </button>
          <button
            onClick={() => handleSpeak(customText)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-glow-cyan flex items-center space-x-2 transition-all"
          >
            <Radio className="w-4 h-4 text-slate-950 animate-pulse" />
            <span>Broadcast Live Audio Alert</span>
          </button>
        </div>
      </div>
    </div>
  );
};
