// ============================================================
// i18n — Internationalization system
// All user-facing strings go here. Each key maps to translations.
// ============================================================

export type LangCode =
  | 'en' | 'hi' | 'bn' | 'ta' | 'te' | 'mr'
  | 'as' | 'kha' | 'gar' | 'miz' | 'nag' | 'bod' | 'man' | 'kok';

export interface Translations {
  // Auth
  welcomeTitle: string;
  chooseRole: string;
  driverRole: string;
  officerRole: string;
  driverRoleDesc: string;
  officerRoleDesc: string;
  loginTitle: string;
  officerLoginTitle: string;
  emailOrId: string;
  mobileOrEmail: string;
  password: string;
  rememberMe: string;
  forgotPassword: string;
  login: string;
  logout: string;
  // Navigation
  home: string;
  trips: string;
  map: string;
  alerts: string;
  profile: string;
  reports: string;
  // Driver Home
  liveLocation: string;
  on: string;
  off: string;
  sharingWith: string;
  currentTrip: string;
  hazardAlerts: string;
  viewMap: string;
  reportEmergency: string;
  continueNavigation: string;
  // Trips
  availableTrips: string;
  tripDetails: string;
  acceptTrip: string;
  viewDetails: string;
  pickup: string;
  destination: string;
  distance: string;
  duration: string;
  capacity: string;
  priority: string;
  normal: string;
  priorityLabel: string;
  urgent: string;
  // Navigation
  nextTurn: string;
  voiceAssistantActive: string;
  enableVoice: string;
  // Emergency
  emergency: string;
  whatHappened: string;
  confirmEmergency: string;
  emergencyReported: string;
  cancel: string;
  done: string;
  alertSent: string;
  // Officer
  reportIncident: string;
  uploadEvidence: string;
  myReports: string;
  activeAlerts: string;
  nearbyOps: string;
  // Report
  createReport: string;
  incidentType: string;
  severity: string;
  location: string;
  dateTime: string;
  description: string;
  submitReport: string;
  reportSubmitted: string;
  // Profile
  profileTitle: string;
  personalInfo: string;
  editProfile: string;
  saveChanges: string;
  cancel2: string;
  // Language
  languageVoice: string;
  saveSettings: string;
  speechSpeed: string;
  voiceGender: string;
  slow: string;
  fast: string;
  female: string;
  male: string;
  // Misc
  online: string;
  offline: string;
  onDuty: string;
  offDuty: string;
  loading: string;
  error: string;
  retry: string;
  noData: string;
  markAllRead: string;
  allNotifications: string;
  critical: string;
  advisory: string;
  submit: string;
  addPhotos: string;
  addVideos: string;
  uploadEvidence2: string;
  takePhoto: string;
  recordVideo: string;
  fromGallery: string;
  secureAccess: string;
  verifyIdentity: string;
  useBiometric: string;
  allowLocation: string;
  notNow: string;
  enableLocation: string;
  locationBenefits: string;
  // Trip states
  tripAccepted: string;
  goingToPickup: string;
  arrivedAtPickup: string;
  packageLoaded: string;
  inTransit: string;
  arrivedAtDest: string;
  delivered: string;
  // Settings
  settings: string;
  notifications: string;
  voiceSettings: string;
  locationSettings: string;
  themeSettings: string;
  // Voice / Navigation strings
  navInstructionContinue: string;
  voiceTestInstruction: string;
}

const en: Translations = {
  welcomeTitle: 'Welcome to Smart Logistics',
  chooseRole: 'Choose how you are accessing the platform.',
  driverRole: 'Driver',
  officerRole: 'Field Officer',
  driverRoleDesc: 'Manage trips, navigate routes and stay informed about road conditions.',
  officerRoleDesc: 'Monitor disaster situations, submit reports and keep teams informed.',
  loginTitle: 'Driver Login',
  officerLoginTitle: 'Field Officer Login',
  emailOrId: 'Employee ID / Email',
  mobileOrEmail: 'Mobile Number / Email',
  password: 'Password',
  rememberMe: 'Remember me',
  forgotPassword: 'Forgot password?',
  login: 'Login',
  logout: 'Logout',
  home: 'Home',
  trips: 'Trips',
  map: 'Map',
  alerts: 'Alerts',
  profile: 'Profile',
  reports: 'Reports',
  liveLocation: 'Live Location',
  on: 'ON',
  off: 'OFF',
  sharingWith: 'Sharing with Logistics Network',
  currentTrip: 'Current Trip',
  hazardAlerts: 'Hazard Alerts',
  viewMap: 'View map',
  reportEmergency: 'Report Emergency',
  continueNavigation: 'Continue Navigation',
  availableTrips: 'Available Trips',
  tripDetails: 'Trip Details',
  acceptTrip: 'Accept Trip',
  viewDetails: 'View Details',
  pickup: 'Pickup',
  destination: 'Destination',
  distance: 'Distance',
  duration: 'Est. Travel Time',
  capacity: 'Capacity',
  priority: 'Priority',
  normal: 'Normal',
  priorityLabel: 'Priority',
  urgent: 'Urgent',
  nextTurn: 'Next turn',
  voiceAssistantActive: 'Voice assistant active',
  enableVoice: 'Enable voice',
  emergency: 'Emergency',
  whatHappened: 'What happened?',
  confirmEmergency: 'Confirm emergency',
  emergencyReported: 'Emergency reported',
  cancel: 'Cancel',
  done: 'Done',
  alertSent: 'Alert sent',
  reportIncident: 'Report Incident',
  uploadEvidence: 'Upload Evidence',
  myReports: 'My Reports',
  activeAlerts: 'Active Alerts',
  nearbyOps: 'Nearby Field Operations',
  createReport: 'Create Incident Report',
  incidentType: 'Incident Type',
  severity: 'Severity',
  location: 'Location',
  dateTime: 'Date & Time',
  description: 'Description',
  submitReport: 'Submit Report',
  reportSubmitted: 'Report Submitted Successfully',
  profileTitle: 'Profile',
  personalInfo: 'Personal Information',
  editProfile: 'Edit',
  saveChanges: 'Save Changes',
  cancel2: 'Cancel',
  languageVoice: 'Language & Voice',
  saveSettings: 'Save Settings',
  speechSpeed: 'Speech Speed',
  voiceGender: 'Voice Gender',
  slow: 'Slow',
  fast: 'Fast',
  female: 'Female',
  male: 'Male',
  online: 'Online',
  offline: 'Offline',
  onDuty: 'On Duty',
  offDuty: 'Off Duty',
  loading: 'Loading…',
  error: 'Something went wrong',
  retry: 'Retry',
  noData: 'No data available',
  markAllRead: 'Mark all read',
  allNotifications: 'All',
  critical: 'Critical',
  advisory: 'Advisory',
  submit: 'Submit',
  addPhotos: 'Add Photos',
  addVideos: 'Add Videos',
  uploadEvidence2: 'Upload Evidence',
  takePhoto: 'Take Photo',
  recordVideo: 'Record Video',
  fromGallery: 'From Gallery',
  secureAccess: 'Secure Access',
  verifyIdentity: 'Verify your identity to access field operations.',
  useBiometric: 'Use biometric authentication',
  allowLocation: 'Allow Current Location',
  notNow: 'Not Now',
  enableLocation: 'Enable Location Access',
  locationBenefits: 'Location access helps us provide live tracking, navigation, route updates and safety alerts.',
  tripAccepted: 'Trip Accepted',
  goingToPickup: 'Going to Pickup',
  arrivedAtPickup: 'Arrived at Pickup',
  packageLoaded: 'Package Loaded',
  inTransit: 'In Transit',
  arrivedAtDest: 'Arrived at Destination',
  delivered: 'Delivered',
  settings: 'Settings',
  notifications: 'Notifications',
  voiceSettings: 'Voice Settings',
  locationSettings: 'Location Settings',
  themeSettings: 'Theme',
  navInstructionContinue: 'Continue straight for 2.3 km toward the pickup point.',
  voiceTestInstruction: 'In 500 metres, turn left toward the main road.',
};

const hi: Translations = {
  ...en,
  welcomeTitle: 'स्मार्ट लॉजिस्टिक्स में आपका स्वागत है',
  chooseRole: 'बताएं आप किस रूप में प्लेटफॉर्म पर आ रहे हैं।',
  driverRole: 'ड्राइवर',
  officerRole: 'फील्ड अधिकारी',
  driverRoleDesc: 'यात्राएं प्रबंधित करें, मार्ग नेविगेट करें और सड़क की स्थिति की जानकारी रखें।',
  officerRoleDesc: 'आपदा स्थितियों की निगरानी करें, रिपोर्ट जमा करें और टीमों को सूचित रखें।',
  loginTitle: 'ड्राइवर लॉगिन',
  officerLoginTitle: 'फील्ड अधिकारी लॉगिन',
  password: 'पासवर्ड',
  rememberMe: 'मुझे याद रखें',
  forgotPassword: 'पासवर्ड भूल गए?',
  login: 'लॉगिन करें',
  logout: 'लॉगआउट',
  home: 'होम',
  trips: 'यात्राएं',
  map: 'मानचित्र',
  alerts: 'अलर्ट',
  profile: 'प्रोफाइल',
  reports: 'रिपोर्ट',
  liveLocation: 'लाइव स्थान',
  on: 'चालू',
  off: 'बंद',
  currentTrip: 'वर्तमान यात्रा',
  hazardAlerts: 'खतरा अलर्ट',
  reportEmergency: 'आपातकाल रिपोर्ट करें',
  continueNavigation: 'नेविगेशन जारी रखें',
  availableTrips: 'उपलब्ध यात्राएं',
  acceptTrip: 'यात्रा स्वीकार करें',
  emergency: 'आपातकाल',
  cancel: 'रद्द करें',
  done: 'हो गया',
  loading: 'लोड हो रहा है…',
  error: 'कुछ गलत हो गया',
  retry: 'पुनः प्रयास करें',
  noData: 'कोई डेटा उपलब्ध नहीं',
  online: 'ऑनलाइन',
  offline: 'ऑफलाइन',
  onDuty: 'ड्यूटी पर',
  offDuty: 'ड्यूटी से बाहर',
  submitReport: 'रिपोर्ट जमा करें',
  saveChanges: 'बदलाव सहेजें',
  saveSettings: 'सेटिंग सहेजें',
  navInstructionContinue: '2.3 किलोमीटर सीधे आगे चलें, पिकअप पॉइंट की ओर।',
  voiceTestInstruction: '500 मीटर बाद बाईं ओर मुड़ें, मुख्य सड़क की ओर।',
};

const as: Translations = {
  ...en,
  welcomeTitle: 'স্মাৰ্ট লজিষ্টিক্সলৈ স্বাগতম',
  driverRole: 'চালক',
  officerRole: 'ফিল্ড বিষয়া',
  login: 'লগইন কৰক',
  logout: 'লগআউট',
  home: 'ঘৰ',
  trips: 'যাত্ৰা',
  map: 'মানচিত্ৰ',
  alerts: 'সতৰ্কতা',
  profile: 'প্ৰফাইল',
  emergency: 'জৰুৰীকালীন',
  loading: 'লোড হৈছে…',
  online: 'অনলাইন',
  offline: 'অফলাইন',
  navInstructionContinue: '২.৩ কিলোমিটাৰ পোনে আগবাঢ়ক, পিকআপ পইণ্টৰ দিশে।',
  voiceTestInstruction: '৫০০ মিটাৰৰ পিছত বাওঁফালে বাঁক নিয়ক, মূল পথৰ দিশে।',
};

const bn: Translations = {
  ...en,
  welcomeTitle: 'স্মার্ট লজিস্টিক্সে আপনাকে স্বাগতম',
  driverRole: 'ড্রাইভার',
  officerRole: 'ফিল্ড অফিসার',
  login: 'লগইন করুন',
  logout: 'লগআউট',
  home: 'হোম',
  trips: 'যাত্রা',
  map: 'মানচিত্র',
  alerts: 'সতর্কতা',
  profile: 'প্রোফাইল',
  emergency: 'জরুরি',
  loading: 'লোড হচ্ছে…',
  online: 'অনলাইন',
  offline: 'অফলাইন',
  navInstructionContinue: '২.৩ কিলোমিটার সোজা এগিয়ে যান, পিকআপ পয়েন্টের দিকে।',
  voiceTestInstruction: '৫০০ মিটার পরে বাম দিকে মোড় নিন, প্রধান সড়কের দিকে।',
};

const ta: Translations = {
  ...en,
  driverRole: 'டிரைவர்',
  officerRole: 'கள அலுவலர்',
  login: 'உள்நுழைய',
  logout: 'வெளியேறு',
  home: 'முகப்பு',
  trips: 'பயணங்கள்',
  map: 'வரைபடம்',
  alerts: 'எச்சரிக்கைகள்',
  profile: 'சுயவிவரம்',
  emergency: 'அவசரநிலை',
  loading: 'ஏற்றுகிறது…',
  online: 'ஆன்லைன்',
  offline: 'ஆஃப்லைன்',
  reportEmergency: 'அவசரநிலை அறிக்கை',
  navInstructionContinue: '2.3 கிலோமீட்டர் நேரடியாக செல்லுங்கள், பிக்அப் பாயிண்ட் நோக்கி.',
  voiceTestInstruction: '500 மீட்டரில் இடதுபுறம் திரும்புங்கள், பிரதான சாலையை நோக்கி.',
};

const te: Translations = {
  ...en,
  driverRole: 'డ్రైవర్',
  officerRole: 'ఫీల్డ్ అధికారి',
  login: 'లాగిన్',
  logout: 'లాగ్అవుట్',
  home: 'హోమ్',
  trips: 'ట్రిప్లు',
  map: 'మ్యాప్',
  alerts: 'హెచ్చరికలు',
  profile: 'ప్రొఫైల్',
  emergency: 'అత్యవసర',
  loading: 'లోడ్ అవుతోంది…',
  online: 'ఆన్‌లైన్',
  offline: 'ఆఫ్‌లైన్',
  reportEmergency: 'అత్యవసర నివేదిక',
  navInstructionContinue: '2.3 కిలోమీటర్లు నేరుగా వెళ్ళండి, పికప్ పాయింట్ వైపు.',
  voiceTestInstruction: '500 మీటర్లలో ఎడమవైపు తిరగండి, ప్రధాన రోడ్డు వైపు.',
};

const mr: Translations = {
  ...en,
  driverRole: 'चालक',
  officerRole: 'क्षेत्र अधिकारी',
  login: 'लॉगिन करा',
  logout: 'लॉगआउट',
  home: 'मुखपृष्ठ',
  trips: 'प्रवास',
  map: 'नकाशा',
  alerts: 'सतर्कता',
  profile: 'प्रोफाइल',
  emergency: 'आपत्कालीन',
  loading: 'लोड होत आहे…',
  online: 'ऑनलाइन',
  offline: 'ऑफलाइन',
  reportEmergency: 'आपत्कालीन अहवाल द्या',
  navInstructionContinue: '2.3 किलोमीटर सरळ जा, पिकअप पॉइंटच्या दिशेने.',
  voiceTestInstruction: '500 मीटरमध्ये डावीकडे वळा, मुख्य रस्त्याच्या दिशेने.',
};

const TRANSLATIONS: Partial<Record<LangCode, Translations>> = {
  en,
  hi,
  as: as,
  bn,
  ta,
  te,
  mr,
  kha: { ...en },
  gar: { ...en },
  miz: { ...en, loading: 'Loading…' },
  nag: { ...en },
  bod: { ...hi },
  man: { ...bn },
  kok: { ...bn },
};

export function t(key: keyof Translations, lang: LangCode = 'en'): string {
  const langData = TRANSLATIONS[lang] || TRANSLATIONS['en']!;
  return langData[key] || TRANSLATIONS['en']![key] || key;
}

export function getTranslations(lang: LangCode): Translations {
  return TRANSLATIONS[lang] || TRANSLATIONS['en']!;
}
