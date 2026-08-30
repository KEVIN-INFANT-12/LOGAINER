/**
 * ML-based Route Hazard & Disaster Prediction Client
 * Interfaces with the backend ConvLSTM risk model service.
 */

export interface RouteHazard {
  hazard_id: string;
  hazard_type: 'Landslide' | 'Flood' | 'Heavy Rain' | 'Severe Weather' | 'Road Blockage' | string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  warning_level: 'FAR' | 'APPROACHING' | 'CRITICAL';
  probability: number;
  latitude: number;
  longitude: number;
  distance_ahead_km: number;
  warning_message: string;
  location_name: string;
  recommended_action: string;
}

export interface PredictRouteHazardsResponse {
  timestamp: string;
  hazards: RouteHazard[];
  evaluated_segments: number;
  highest_risk_level: string;
  model: string;
}

const ML_SERVICE_URL = (import.meta as any).env?.VITE_ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Request ML disaster and route-ahead hazard predictions for the driver's current position and route.
 */
export async function fetchPredictedRouteHazards(
  currentLat: number,
  currentLng: number,
  routeCoordinates: Array<{ lat: number; lng: number }>,
  lookaheadKm: number = 35.0
): Promise<RouteHazard[]> {
  try {
    // Format coordinates as [[lng, lat], ...] for GeoJSON conventions
    const formattedCoords = routeCoordinates.map((c) => [c.lng, c.lat]);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${ML_SERVICE_URL}/predict-route-hazards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitude: currentLat,
        longitude: currentLng,
        route_coordinates: formattedCoords,
        lookahead_km: lookaheadKm,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`ML prediction service returned status ${response.status}`);
      return [];
    }

    const data: PredictRouteHazardsResponse = await response.json();
    return data.hazards || [];
  } catch (err: any) {
    // Gracefully handle network/API failures so navigation remains uninterrupted
    console.warn('ML Prediction Service unavailable or timed out:', err?.message || err);
    return [];
  }
}

/**
 * Format localized voice alert for a predicted hazard
 */
export function formatLocalizedHazardVoice(
  hazard: RouteHazard,
  langCode: string
): string {
  const distKm = hazard.distance_ahead_km >= 1 ? `${Math.round(hazard.distance_ahead_km)}` : '1';
  const type = hazard.hazard_type;

  switch (langCode) {
    case 'hi':
      if (type === 'Landslide') return `चेतावनी। आगे लगभग ${distKm} किलोमीटर पर भूस्खलन का खतरा है। कृपया सावधानी से चलें।`;
      if (type === 'Flood') return `चेतावनी। आगे ${distKm} किलोमीटर पर बाढ़ का खतरा है। सुरक्षित रास्ता चुनें।`;
      if (type === 'Heavy Rain') return `चेतावनी। आगे ${distKm} किलोमीटर पर भारी बारिश की संभावना है। गति धीमी करें।`;
      return `चेतावनी। आगे ${distKm} किलोमीटर पर सड़क पर खतरा देखा गया है।`;

    case 'as':
      if (type === 'Landslide') return `সতর্কবাণী। প্ৰায় ${distKm} কিলোমিটাৰ আগত ভূমিস্খলনৰ সম্ভাৱনা আছে। সাৱধানে চলক।`;
      if (type === 'Flood') return `সতর্কবাণী। আগত ${distKm} কিলোমিটাৰত বানপানীৰ সতৰ্কতা। বিকল্প পথ বাছক।`;
      if (type === 'Heavy Rain') return `সতর্কবাণী। আগত ${distKm} কিলোমিটাৰত প্ৰবল বৰষুণৰ সম্ভাৱনা।`;
      return `সতর্কবাণী। আগত ${distKm} কিলোমিটাৰত পথৰ বিপদ দেখা গৈছে।`;

    case 'bn':
      if (type === 'Landslide') return `সতর্কতা। প্রায় ${distKm} কিলোমিটার সামনে ভূমিধসের ঝুঁকি রয়েছে। সাবধানে গাড়ি চালান।`;
      if (type === 'Flood') return `সতর্কতা। সামনে ${distKm} কিলোমিটারে বন্যার সতর্কতা রয়েছে।`;
      if (type === 'Heavy Rain') return `সতর্কতা। সামনে ${distKm} কিলোমিটারে ভারী বৃষ্টির সম্ভাবনা। গতি কমান।`;
      return `সতর্কতা। সামনে ${distKm} কিলোমিটারে বিপদের ঝুঁকি রয়েছে।`;

    case 'ta':
      if (type === 'Landslide') return `எச்சரிக்கை. சுமார் ${distKm} கிலோமீட்டர் முன்னால் நிலச்சரிவு அபாயம் உள்ளது. எச்சரிக்கையுடன் செல்லவும்.`;
      if (type === 'Flood') return `எச்சரிக்கை. முன்னால் ${distKm} கிலோமீட்டரில் வெள்ள அபாயம் உள்ளது.`;
      return `எச்சரிக்கை. முன்னால் ${distKm} கிலோமீட்டரில் ஆபத்து கண்டறியப்பட்டுள்ளது.`;

    case 'te':
      if (type === 'Landslide') return `హెచ్చరిక. దాదాపు ${distKm} కిలోమీటర్ల ముందు కొండచరియలు విరిగిపడే ప్రమాదం ఉంది. జాగ్రత్తగా నడపండి.`;
      if (type === 'Flood') return `హెచ్చరిక. ముందు ${distKm} కిలోమీటర్లలో వరద ప్రమాదం ఉంది.`;
      return `హెచ్చరిక. ముందు ${distKm} కిలోమీటర్లలో ప్రమాదం గుర్తించబడింది.`;

    case 'mr':
      if (type === 'Landslide') return `सावधान. पुढे अंदाजे ${distKm} किलोमीटरवर दरड कोसळण्याचा धोका आहे. कृपया काळजीपूर्वक वाहन चालवा.`;
      if (type === 'Flood') return `सावधान. पुढे ${distKm} किलोमीटरवर पुराचा धोका आहे.`;
      return `सावधान. पुढे ${distKm} किलोमीटरवर धोक्याची शक्यता आहे.`;

    default: // English
      if (type === 'Landslide') {
        return `Warning. Landslide risk detected approximately ${distKm} kilometers ahead. Please proceed carefully.`;
      }
      if (type === 'Flood') {
        return `Warning. Flood risk detected approximately ${distKm} kilometers ahead. Drive with caution.`;
      }
      if (type === 'Heavy Rain') {
        return `Warning. Heavy rainfall predicted ${distKm} kilometers ahead. Reduce speed and drive carefully.`;
      }
      if (type === 'Severe Weather') {
        return `Warning. Severe weather conditions detected ${distKm} kilometers ahead.`;
      }
      return `Warning. Road disruption risk detected approximately ${distKm} kilometers ahead.`;
  }
}
