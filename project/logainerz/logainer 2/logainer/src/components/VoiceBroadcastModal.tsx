import React, { useState, useEffect } from 'react';
import { 
  X, 
  Volume2, 
  Radio, 
  Languages 
} from 'lucide-react';
import { useLanguage, LANGUAGES } from '../context/LanguageContext';

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
      text: 'ഗുവാഹത്തിയിൽ നിന്ന് സിൽച്ചാറിലേക്കുള്ള ഓക്സിജൻ ടാങ്കറുകൾക്കായി ഗ്രീൻ കോറിഡോർ സജ്ಜമാക്കി. NDRF സുരക്ഷ നിലവിലുണ്ട്.'
    }
  ],
  hi: [
    {
      title: 'सोनापुर टनल अवरोध चेतावनी',
      text: 'काफिले के चालकों का ध्यान दें: राष्ट्रीय राजमार्ग 6 पर सोनापुर सुरंग भारी मलबे के कारण पूरी तरह से बंद है। कृपया उमरांगसो-हाफलोंग ग्रीन कॉरिडोर बाईपास का उपयोग करें।'
    },
    {
      title: 'सेला पास बर्फबारी चेतावनी',
      text: 'तवांग कॉरिडोर चेतावनी: सेला पास में भारी बर्फबारी हो रही है। टायर चेन लगाना अनिवार्य है।'
    },
    {
      title: 'मेडिकल ऑक्सीजन इमरजेंसी एस्कॉर्ट',
      text: 'गुवाहाटी से सिलचर जाने वाले ऑक्सीजन टैंकरों के लिए ग्रीन कॉरिडोर खोला गया है।'
    }
  ],
  as: [
    {
      title: 'সোণাপুৰ সুৰংগ অৱৰোধ সতৰ্কবাৰ্তা',
      text: 'চালকসকলৰ দৃষ্টি আকৰ্ষণ: ৰাষ্ট্ৰীয় ঘাইপথ ৬ ৰ সোণাপুৰ সুৰংগ সম্পূৰ্ণৰূপে বন্ধ হৈ আছে। অনুগ্ৰহ কৰি উমৰাংছ’-হাফলং বিকল্প পথ ব্যৱহাৰ কৰক।'
    },
    {
      title: 'চেলা পাছ বৰফ সতৰ্কবাৰ্তা',
      text: 'চেলা পাছত প্ৰচণ্ড বৰফপাত আৰু পিচ্ছিল পথৰ বাবে সতৰ্কতা অৱলম্বন কৰক।'
    }
  ],
  bn: [
    {
      title: 'সোনাপুর টানেল অবরুদ্ধ সতর্কতা',
      text: 'চালকবৃন্দের দৃষ্টি আকর্ষণ: জাতীয় সড়ক ৬-এর সোনাপুর টানেল কাদার কারণে সম্পূর্ণ অবরুদ্ধ। বিকল্প হিসেবে উমরাংসো-হাফলং পথ ব্যবহার করুন।'
    }
  ]
};

export const VoiceBroadcastModal: React.FC<VoiceBroadcastModalProps> = ({ isOpen, onClose }) => {
  const { language, setLanguage, speakAlert } = useLanguage();
  const [customText, setCustomText] = useState('');

  const currentPresets = MULTILINGUAL_PRESETS[language] || MULTILINGUAL_PRESETS['en'];

  useEffect(() => {
    if (currentPresets.length > 0) {
      setCustomText(currentPresets[0].text);
    }
  }, [language]);

  if (!isOpen) return null;

  const handleSpeak = (textToSpeak: string) => {
    if (textToSpeak) {
      speakAlert(textToSpeak);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-modal border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Multilingual Driver Voice Synthesizer</h3>
              <p className="text-xs text-slate-500">Instant regional language text-to-speech hazard broadcast</p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1.5">
            <Languages className="w-3.5 h-3.5 text-teal-700" />
            <span>Select Broadcast Language:</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1 rounded-lg bg-slate-50 border border-slate-200">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all border ${
                  language === lang.code
                    ? 'bg-teal-50 text-teal-800 border-teal-300 font-bold shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
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
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-teal-400 hover:bg-teal-50/30 cursor-pointer text-xs transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-slate-900 group-hover:text-teal-800">{preset.title}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">{preset.text}</div>
                </div>
                <Volume2 className="w-4 h-4 text-teal-700 shrink-0 ml-2 group-hover:scale-110" />
              </div>
            ))}
          </div>
        </div>

        {/* Custom Textarea */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Custom Audio Broadcast:</label>
          <textarea
            rows={3}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-teal-700"
          />
        </div>

        {/* Speak Button */}
        <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 text-xs font-semibold"
          >
            Close
          </button>
          <button
            onClick={() => handleSpeak(customText)}
            className="px-5 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm flex items-center space-x-2 transition-all"
          >
            <Radio className="w-4 h-4" />
            <span>Broadcast Live Audio Alert</span>
          </button>
        </div>
      </div>
    </div>
  );
};
