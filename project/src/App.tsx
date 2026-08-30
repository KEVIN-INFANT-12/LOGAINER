import {
  useState, useEffect, useRef, useCallback, useMemo, forwardRef, type ReactNode, type ChangeEvent,
} from 'react';
import {
  AlertTriangle, ArrowRight, ArrowLeft, Bell, Check, ChevronDown, ChevronRight,
  CircleUserRound, ClipboardList, Clock, CloudRain, Eye, EyeOff,
  FileText, Fingerprint, FolderOpen, Home, Image,
  Languages, Map as MapIcon, MapPin, Mic, MicOff, Navigation,
  Package, Phone, Plus, Route, Search, Settings, Shield, ShieldCheck,
  Siren, Truck, Upload, UserRound, Video, Volume2, X, Zap,
  Camera, Crosshair, Gauge, Loader2, Minus,
  Star, TrendingUp, Users, Trash2, Calendar, RefreshCw, WifiOff, CheckCheck,
  UserCheck, Send, ParkingSquare, Fuel, Hotel, TreePine, Activity, Flag,
  Play, Pause, RotateCcw, CornerUpLeft, CornerUpRight, Compass,
} from 'lucide-react';
import {
  type Role, type Screen, type Trip, type Priority, type DisasterMarker,
  type NotificationItem, type LanguageItem, type IncidentType, type Severity,
  type CitizenSubmission,
  languages, emergencyTypes, incidentCategories,
} from './types';
import { useApp } from './contexts/AppContext';
import type { AppTrip, AppIncident, AppNotification } from './contexts/AppContext';
import MapView, { type MapViewRef } from './components/MapView';
import { speak, cancelSpeech, getRateForSetting, speakEmergencyAlert, speakInstruction, speakDisasterWarning } from './lib/speech';
import { t } from './lib/i18n';
import type { LangCode } from './lib/i18n';
import {
  calculateRoutes, findSafeHalts, formatDuration, haversineDistance,
  calculateBearing, formatLocalizedInstruction, isValidCoordinate,
  type RouteOption, type RouteStep, type SafeHalt,
} from './lib/routing';
import {
  fetchPredictedRouteHazards, formatLocalizedHazardVoice,
  type RouteHazard,
} from './lib/mlPrediction';

/* ============ HELPERS ============ */

function useProgress(duration: number) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => (p >= 100 ? 100 : p + 100 / (duration / 50)));
    }, 50);
    return () => clearInterval(interval);
  }, [duration]);
  return progress;
}

function useTypewriter(text: string, speed: number, start: boolean) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!start) return;
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      if (i <= text.length) { setDisplayed(text.slice(0, i)); i++; }
      else clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, start]);
  return displayed;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} day ago`;
}

const priorityBadge: Record<Priority, { label: string; cls: string }> = {
  normal: { label: 'Normal', cls: 'badge-neutral' },
  priority: { label: 'Priority', cls: 'badge-teal' },
  urgent: { label: 'Urgent', cls: 'badge-red' },
};

const severityBadge: Record<Severity, { label: string; cls: string }> = {
  low: { label: 'Low severity', cls: 'badge-amber' },
  medium: { label: 'Medium severity', cls: 'badge-orange' },
  high: { label: 'High severity', cls: 'badge-red' },
};

/* ============ PRIMITIVES ============ */

function Button({
  children, variant = 'primary', size = 'md', full, leftIcon, rightIcon, loading, ...props
}: {
  children: ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg'; full?: boolean; leftIcon?: ReactNode; rightIcon?: ReactNode;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `btn btn-${variant} btn-${size}${full ? ' btn-full' : ''}`;
  return (
    <button className={cls} {...props} disabled={props.disabled || loading}>
      {loading ? <Loader2 size={16} className="spin" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`badge ${cls}`}>{label}</span>;
}

function StatusDot({ variant = 'green', label }: { variant?: 'green' | 'amber' | 'red'; label?: string }) {
  return <span className={`status-dot status-dot-${variant}`}>{label && <i />}{label}</span>;
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      className={`toggle ${on ? 'on' : ''}`}
      onClick={onChange}
      disabled={disabled}
      style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
    >
      <span />
    </button>
  );
}

function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <div className={`card ${className}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>{children}</div>;
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {action && <button onClick={onAction}>{action} <ArrowRight size={15} /></button>}
    </div>
  );
}

function Input({
  label, icon, type = 'text', placeholder, value, onChange, rightElement, error, required,
}: {
  label?: string; icon?: ReactNode; type?: string; placeholder?: string;
  value?: string; onChange?: (v: string) => void; rightElement?: ReactNode;
  error?: string; required?: boolean;
}) {
  return (
    <label className="input-group">
      {label && <span className="input-label">{label}{required && ' *'}</span>}
      <div className={`input-wrapper${error ? ' input-error' : ''}`}>
        {icon && <span className="input-icon">{icon}</span>}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
        {rightElement}
      </div>
      {error && <span style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>{error}</span>}
    </label>
  );
}

function TextArea({
  label, placeholder, value, onChange,
}: {
  label?: string; placeholder?: string; value?: string; onChange?: (v: string) => void;
}) {
  return (
    <label className="input-group">
      {label && <span className="input-label">{label}</span>}
      <textarea
        className="input-textarea"
        placeholder={placeholder}
        rows={3}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  );
}

function Select({
  label, options, value, onChange,
}: {
  label?: string; options: string[]; value?: string; onChange?: (v: string) => void;
}) {
  return (
    <label className="input-group">
      {label && <span className="input-label">{label}</span>}
      <div className="input-wrapper select-wrapper">
        <select value={value || options[0]} onChange={(e) => onChange?.(e.target.value)}>
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown size={18} className="select-chevron" />
      </div>
    </label>
  );
}

function ScreenHeader({
  title, subtitle, onBack, right,
}: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="screen-header">
      {onBack && <button className="back-btn" onClick={onBack}><ArrowLeft size={20} /></button>}
      <div className="screen-header-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function LoadingScreen({ message = 'Loading…' }: { message?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', gap: 16, color: 'var(--text-muted)',
    }}>
      <Loader2 size={32} className="spin" style={{ color: 'var(--teal)' }} />
      <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
      background: 'var(--red-light)', border: '1px solid #f3b7b1', borderRadius: 'var(--radius-sm)',
      margin: '8px 0',
    }}>
      <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: 'var(--red)' }}>{message}</span>
      {onRetry && (
        <button onClick={onRetry} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
      background: 'var(--amber-light)', borderBottom: '1px solid #fcd34d',
      fontSize: 12, fontWeight: 600, color: 'var(--amber)',
    }}>
      <WifiOff size={14} /> You're offline. Some features may be limited.
    </div>
  );
}

/* ============ MAP CANVAS (CSS fallback / Map Wrapper) ============ */

const MapCanvas = forwardRef<MapViewRef, {
  markers?: DisasterMarker[]; height?: string;
  interactive?: boolean;
  onMarker?: (m: DisasterMarker) => void;
  onHalt?: (h: SafeHalt) => void;
  predictedHazards?: RouteHazard[];
  onHazardClick?: (h: RouteHazard) => void;
  userLat?: number | null; userLng?: number | null;
  userAccuracy?: number | null;
  vehicleLat?: number | null;
  vehicleLng?: number | null;
  vehicleHeading?: number;
  isSimulating?: boolean;
  autoFollowVehicle?: boolean;
  onUserPan?: () => void;
  pickupLat?: number | null; pickupLng?: number | null;
  destLat?: number | null; destLng?: number | null;
  routes?: RouteOption[];
  selectedRouteIndex?: number;
  showRoute?: boolean;
  safeHalts?: SafeHalt[];
}>((props, ref) => {
  const internalRef = useRef<MapViewRef>(null);
  const activeRef = (ref as React.RefObject<MapViewRef>) || internalRef;
  const {
    markers = [], height = '100%', interactive = true,
    onMarker, onHalt, predictedHazards = [], onHazardClick,
    userLat, userLng, userAccuracy,
    vehicleLat, vehicleLng, vehicleHeading, isSimulating, autoFollowVehicle, onUserPan,
    pickupLat, pickupLng, destLat, destLng,
    routes, selectedRouteIndex, showRoute,
    safeHalts,
  } = props;

  return (
    <div className="map-canvas" style={{ height }}>
      <MapView
        ref={activeRef}
        height={height}
        userLat={userLat}
        userLng={userLng}
        userAccuracy={userAccuracy}
        vehicleLat={vehicleLat}
        vehicleLng={vehicleLng}
        vehicleHeading={vehicleHeading}
        isSimulating={isSimulating}
        autoFollowVehicle={autoFollowVehicle}
        onUserPan={onUserPan}
        predictedHazards={predictedHazards}
        onHazardClick={onHazardClick}
        incidents={markers}
        pickupLat={pickupLat}
        pickupLng={pickupLng}
        destLat={destLat}
        destLng={destLng}
        routes={routes}
        selectedRouteIndex={selectedRouteIndex}
        showRoute={showRoute}
        interactive={interactive}
        onMarker={onMarker}
        onHalt={onHalt}
        safeHalts={safeHalts}
      />
      {interactive && (
        <div className="map-controls">
          <button onClick={() => {
            if (isSimulating && vehicleLat && vehicleLng) {
              activeRef.current?.centerOnVehicle(vehicleLat, vehicleLng);
            } else {
              activeRef.current?.centerOnUser();
            }
          }} title={isSimulating ? "Center on Vehicle" : "My location"}>
            <Crosshair size={17} />
          </button>
          <div className="zoom-group">
            <button onClick={() => activeRef.current?.zoomIn()}><Plus size={16} /></button>
            <button onClick={() => activeRef.current?.zoomOut()}><Minus size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
});
MapCanvas.displayName = 'MapCanvas';

function ManeuverIcon({ type, modifier }: { type?: string; modifier?: string }) {
  if (type === 'arrive') return <Flag size={24} style={{ color: '#fff' }} />;
  if (type === 'depart') return <Compass size={24} style={{ color: '#fff' }} />;
  if (modifier === 'left' || modifier === 'sharp left') return <CornerUpLeft size={24} style={{ color: '#fff' }} />;
  if (modifier === 'right' || modifier === 'sharp right') return <CornerUpRight size={24} style={{ color: '#fff' }} />;
  if (modifier === 'slight left') return <ArrowLeft size={24} style={{ color: '#fff' }} />;
  if (modifier === 'slight right') return <ArrowRight size={24} style={{ color: '#fff' }} />;
  if (modifier === 'uturn') return <RotateCcw size={24} style={{ color: '#fff' }} />;
  return <Navigation size={24} style={{ color: '#fff' }} />;
}

function MarkerSheet({ marker, onClose }: { marker: DisasterMarker; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <button className="sheet-close" onClick={onClose}><X size={18} /></button>
        <div className={`sheet-marker marker-${marker.variant}`}>
          {marker.type === 'Landslide' ? '!' : marker.type === 'Flood' ? '≈' : '×'}
        </div>
        <span className="eyebrow">Live incident</span>
        <h2>{marker.label}</h2>
        <p>{marker.detail}</p>
        <div className="sheet-meta-grid">
          <div><small>Distance</small><strong>{marker.distance}</strong></div>
          <div><small>Reported</small><strong>{marker.timeReported}</strong></div>
        </div>
        <Badge label={severityBadge[marker.severity].label} cls={severityBadge[marker.severity].cls} />
        <div className="sheet-action-box">
          <small>Recommended action</small>
          <strong>{marker.action}</strong>
        </div>
        <Button full onClick={onClose}>Acknowledge alert</Button>
      </div>
    </div>
  );
}

/* ============ EMERGENCY FLOW ============ */

function EmergencyModal({
  step, setStep, onClose,
}: {
  step: 'select' | 'sent'; setStep: (s: 'select' | 'sent') => void; onClose: () => void;
}) {
  const { submitEmergency, location, language, speechSpeed, voiceGender } = useApp();
  const [selected, setSelected] = useState<IncidentType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('your current location');
  const sentProgress = useProgress(1800);

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    const result = await submitEmergency(selected);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setLocationName(result.locationName);
    // Speak the alert
    const rate = getRateForSetting(speechSpeed);
    speakEmergencyAlert(selected, result.locationName, language, rate);
    setStep('sent');
    setLoading(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        {step === 'select' ? (
          <>
            <div className="modal-icon modal-icon-danger"><Siren size={26} /></div>
            <span className="eyebrow eyebrow-danger">Emergency response</span>
            <h2>{t('whatHappened', language)}</h2>
            <p className="modal-desc">
              Select the situation. Your location and identity will be attached automatically.
            </p>
            {!location.lat && (
              <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                <MapPin size={13} /> Location not available — report will be submitted without GPS coordinates.
              </div>
            )}
            {error && <ErrorBanner message={error} />}
            <div className="emergency-grid">
              {emergencyTypes.map((type) => (
                <button
                  key={type}
                  className={`emergency-option ${selected === type ? 'selected' : ''}`}
                  onClick={() => setSelected(type)}
                >
                  <AlertTriangle size={18} />
                  <span>{type}</span>
                </button>
              ))}
            </div>
            <Button
              variant="danger" full size="lg"
              disabled={!selected} loading={loading}
              onClick={handleConfirm}
            >
              <Siren size={18} /> {t('confirmEmergency', language)}
            </Button>
            <Button variant="ghost" full onClick={onClose}>{t('cancel', language)}</Button>
          </>
        ) : (
          <>
            <div className="modal-icon modal-icon-success"><Check size={28} /></div>
            <div className="sent-progress-ring">
              <svg width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#d8f7f1" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r="28" fill="none" stroke="#006a61" strokeWidth="4"
                  strokeDasharray={176} strokeDashoffset={176 - (176 * sentProgress) / 100}
                  strokeLinecap="round" transform="rotate(-90 32 32)"
                />
              </svg>
            </div>
            <span className="eyebrow eyebrow-success">{t('alertSent', language)}</span>
            <h2>{t('emergencyReported', language)}</h2>
            <p className="modal-desc">
              {selected || 'Emergency'} reported at {locationName}. The operations desk has been notified.
            </p>
            <div className="sent-detail-grid">
              <div><small>Alert type</small><strong>{selected || 'Emergency'}</strong></div>
              <div><small>Location</small><strong>{locationName}</strong></div>
              <div><small>Timestamp</small><strong>{new Date().toLocaleTimeString()}</strong></div>
              <div><small>Voice alert</small><strong>Read aloud · {language.toUpperCase()}</strong></div>
            </div>
            <div className="sent-voice-bar">
              <Volume2 size={18} />
              <div className="sent-voice-wave">
                <span /><span /><span /><span /><span />
              </div>
              <span>Voice alert broadcasted</span>
            </div>
            <Button full size="lg" onClick={onClose}>{t('done', language)}</Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ============ BOTTOM NAV ============ */

function BottomNav({
  tabs, active, onChange, alertCount = 0,
}: {
  tabs: { id: string; label: string; icon: typeof Home }[];
  active: string; onChange: (id: string) => void; alertCount?: number;
}) {
  return (
    <nav className="bottom-nav">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={active === id ? 'active' : ''}
          onClick={() => onChange(id)}
        >
          <Icon size={20} />
          <span>{label}</span>
          {id === 'alerts' && alertCount > 0 && <i>{alertCount}</i>}
        </button>
      ))}
    </nav>
  );
}

/* ============ ONBOARDING ============ */

function SplashScreen({ onDone }: { onDone: () => void }) {
  const progress = useProgress(2200);
  useEffect(() => {
    if (progress >= 100) { const t = setTimeout(onDone, 300); return () => clearTimeout(t); }
  }, [progress, onDone]);
  return (
    <div className="splash-screen">
      <div className="splash-bg-grid" />
      <div className="splash-content">
        <div className="splash-logo">
          <div className="splash-logo-ring" />
          <div className="splash-logo-ring splash-logo-ring-2" />
          <ShieldCheck size={36} />
        </div>
        <h1 className="splash-title">Smart Logistics</h1>
        <p className="splash-tagline">Smart Logistics. Safer Journeys.</p>
        <div className="splash-loader">
          <div className="splash-loader-bar" style={{ width: `${progress}%` }} />
        </div>
        <p className="splash-status">Initializing secure systems…</p>
      </div>
    </div>
  );
}

function RoleSelectScreen({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div className="auth-screen">
      <div className="auth-header">
        <div className="auth-logo"><ShieldCheck size={28} /></div>
        <h1>Welcome to Smart Logistics</h1>
        <p>Choose how you are accessing the platform.</p>
      </div>
      <div className="role-cards">
        <button className="role-card" onClick={() => onSelect('driver')}>
          <div className="role-card-icon role-icon-teal"><Truck size={30} /></div>
          <div className="role-card-body">
            <strong>Driver</strong>
            <p>Manage trips, navigate routes and stay informed about road conditions.</p>
          </div>
          <ChevronRight size={22} className="role-card-arrow" />
        </button>
        <button className="role-card" onClick={() => onSelect('officer')}>
          <div className="role-card-icon role-icon-navy"><ShieldCheck size={30} /></div>
          <div className="role-card-body">
            <strong>Field Officer</strong>
            <p>Monitor disaster situations, submit reports and keep teams informed.</p>
          </div>
          <ChevronRight size={22} className="role-card-arrow" />
        </button>
        <button className="role-card" onClick={() => onSelect('citizen')}>
          <div className="role-card-icon role-icon-citizen"><UserCheck size={30} /></div>
          <div className="role-card-body">
            <strong>Citizen</strong>
            <p>Report what you see. Upload field evidence to help disaster response teams.</p>
          </div>
          <ChevronRight size={22} className="role-card-arrow" />
        </button>
      </div>
      <p className="auth-footer">Protected by Smart Logistics Security Framework</p>
    </div>
  );
}

function LoginScreen({
  role, onLogin, onBack, onSignup,
}: { role: Role; onLogin: () => void; onBack: () => void; onSignup?: () => void }) {
  const { login, isConfigured } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const isOfficer = role === 'officer';
  const isCitizen = role === 'citizen';

  const handleLogin = async () => {
    setEmailErr(''); setPwdErr(''); setError(null);
    let valid = true;
    if (!email.trim()) { setEmailErr('Email is required'); valid = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setEmailErr('Enter a valid email address'); valid = false; }
    if (!password) { setPwdErr('Password is required'); valid = false; }
    if (!valid) return;

    setLoading(true);
    const result = await login(email.trim(), password, role);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    onLogin();
  };

  return (
    <div className="auth-screen">
      <div className="auth-top-bar">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={20} /></button>
      </div>
      <div className="auth-header">
        <div className={`auth-logo ${isOfficer ? 'auth-logo-navy' : isCitizen ? 'auth-logo-citizen' : ''}`}>
          {isOfficer ? <ShieldCheck size={28} /> : isCitizen ? <UserCheck size={28} /> : <Truck size={28} />}
        </div>
        <h1>{isOfficer ? 'Field Officer Login' : isCitizen ? 'Citizen Login' : 'Driver Login'}</h1>
        <p>{isOfficer ? 'Access field operations portal' : isCitizen ? 'Report what you see. Help your community.' : 'Access your logistics dashboard'}</p>
      </div>
      {!isConfigured && (
        <div style={{
          background: 'var(--amber-light)', border: '1px solid #fcd34d', borderRadius: 'var(--radius-sm)',
          padding: '10px 14px', fontSize: 12, color: 'var(--amber)', marginBottom: 16,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Demo Mode:</strong> Supabase is not configured. Use any email and password to log in.
            Data will not persist between sessions.
          </div>
        </div>
      )}
      <div className="auth-form">
        {error && <ErrorBanner message={error} />}
        <Input
          label={isOfficer ? 'Employee ID / Email' : 'Email'}
          icon={isOfficer ? <ShieldCheck size={18} /> : <CircleUserRound size={18} />}
          placeholder={isOfficer ? 'FO-10842 or name@fieldops.org' : 'name@example.com'}
          value={email}
          onChange={setEmail}
          error={emailErr}
          required
        />
        <Input
          label="Password"
          icon={<Shield size={18} />}
          type={showPwd ? 'text' : 'password'}
          placeholder="Enter your password"
          value={password}
          onChange={setPassword}
          error={pwdErr}
          required
          rightElement={
            <button className="input-action" type="button" onClick={() => setShowPwd(!showPwd)}>
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />
        <div className="auth-form-row">
          <button className="checkbox-row" onClick={() => setRemember(!remember)}>
            <span className={`check-box ${remember ? 'checked' : ''}`}>{remember && <Check size={14} />}</span>
            Remember me
          </button>
          <button className="link-btn" onClick={() => alert('Password reset: Please use the forgot password flow or contact your administrator.')}>Forgot password?</button>
        </div>
        <Button full size="lg" loading={loading} onClick={handleLogin}>
          Login <ArrowRight size={18} />
        </Button>
        {onSignup && (
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <button className="link-btn" onClick={onSignup} style={{ fontWeight: 600 }}>Sign up</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SignupScreen({
  role, onSignup, onBack,
}: { role: Role; onSignup: () => void; onBack: () => void }) {
  const { register, isConfigured } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isCitizen = role === 'citizen';

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Full name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address';
    if (phone && !/^[+]?[0-9\s\-]{8,15}$/.test(phone)) e.phone = 'Enter a valid phone number';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters';
    else if (!/(?=.*[A-Z])(?=.*[0-9])/.test(password)) e.password = 'Must contain a number and uppercase letter';
    if (!confirmPwd) e.confirmPwd = 'Please confirm your password';
    else if (password !== confirmPwd) e.confirmPwd = 'Passwords do not match';
    return e;
  };

  const handleSignup = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!isConfigured) { setError('Supabase is not configured. Cannot register in demo mode.'); return; }
    setLoading(true);
    setError(null);
    const result = await register(email.trim(), password, role, name.trim(), phone.trim() || undefined);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    onSignup();
  };

  return (
    <div className="auth-screen">
      <div className="auth-top-bar">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={20} /></button>
      </div>
      <div className="auth-header">
        <div className={`auth-logo ${isCitizen ? 'auth-logo-citizen' : ''}`}>
          {isCitizen ? <UserCheck size={28} /> : role === 'officer' ? <ShieldCheck size={28} /> : <Truck size={28} />}
        </div>
        <h1>Create Account</h1>
        <p>{isCitizen ? 'Join as a Citizen reporter' : role === 'officer' ? 'Register as a Field Officer' : 'Register as a Driver'}</p>
      </div>
      <div className="auth-form">
        {error && <ErrorBanner message={error} />}
        {!isConfigured && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid #fcd34d', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 12, color: 'var(--amber)', marginBottom: 16, display: 'flex', gap: 8 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div><strong>Demo Mode:</strong> Registration requires a configured Supabase backend.</div>
          </div>
        )}
        <Input label="Full Name" icon={<UserRound size={18} />} placeholder="Your full name" value={name} onChange={setName} error={errors.name} required />
        <Input label="Email" icon={<CircleUserRound size={18} />} placeholder="name@example.com" value={email} onChange={setEmail} error={errors.email} required />
        <Input label="Phone (optional)" icon={<Phone size={18} />} placeholder="+91 98765 43210" value={phone} onChange={setPhone} error={errors.phone} />
        <Input
          label="Password"
          icon={<Shield size={18} />}
          type={showPwd ? 'text' : 'password'}
          placeholder="Min 8 chars, 1 number, 1 uppercase"
          value={password}
          onChange={setPassword}
          error={errors.password}
          required
          rightElement={
            <button className="input-action" type="button" onClick={() => setShowPwd(!showPwd)}>
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />
        <Input label="Confirm Password" icon={<Shield size={18} />} type="password" placeholder="Re-enter your password" value={confirmPwd} onChange={setConfirmPwd} error={errors.confirmPwd} required />
        <Button full size="lg" loading={loading} onClick={handleSignup}>
          Create Account <ArrowRight size={18} />
        </Button>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <button className="link-btn" onClick={onBack} style={{ fontWeight: 600 }}>Login</button>
        </div>
      </div>
    </div>
  );
}

function SecurityLockScreen({ onUnlock, onBack }: { onUnlock: () => void; onBack: () => void }) {
  const { verifyPin, pinSet, setPin } = useApp();
  const [pin, setLocalPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [settingPin, setSettingPin] = useState(!pinSet);
  const [confirmPin, setConfirmPin] = useState('');
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter');
  const [saving, setSaving] = useState(false);

  const press = async (digit: string) => {
    if (verifying) return;
    if (settingPin) {
      // PIN setup flow
      const current = stage === 'enter' ? pin : confirmPin;
      if (current.length >= 4) return;
      const next = current + digit;
      if (stage === 'enter') {
        setLocalPin(next);
        if (next.length === 4) { setTimeout(() => setStage('confirm'), 200); }
      } else {
        setConfirmPin(next);
        if (next.length === 4) {
          if (next !== pin) {
            setError(true);
            setErrorMsg('PINs do not match. Try again.');
            setTimeout(() => { setError(false); setLocalPin(''); setConfirmPin(''); setStage('enter'); }, 1500);
          } else {
            setSaving(true);
            await setPin(pin);
            setSaving(false);
            setSettingPin(false);
          }
        }
      }
      return;
    }

    // Verify flow
    if (pin.length >= 4) return;
    const next = pin + digit;
    setLocalPin(next);
    setError(false);
    if (next.length === 4) {
      setVerifying(true);
      const ok = await verifyPin(next);
      setVerifying(false);
      if (ok) { onUnlock(); }
      else {
        setError(true);
        setErrorMsg('Incorrect PIN. Please try again.');
        setTimeout(() => { setError(false); setLocalPin(''); setErrorMsg(''); }, 1500);
      }
    }
  };

  const currentPin = stage === 'confirm' ? confirmPin : pin;

  return (
    <div className="auth-screen security-screen">
      <div className="auth-top-bar">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={20} /></button>
      </div>
      <div className="security-content">
        <div className={`security-lock-illustration ${error ? 'error' : ''} ${verifying ? 'verifying' : ''}`}>
          <Shield size={48} />
          <div className="security-lock-ring" />
        </div>
        <span className="eyebrow">Field Operations</span>
        <h1>{t('secureAccess', 'en')}</h1>
        {settingPin ? (
          <p>{stage === 'enter' ? 'Create a 4-digit PIN for secure access.' : 'Confirm your PIN.'}</p>
        ) : (
          <p>{t('verifyIdentity', 'en')}</p>
        )}
        {saving && <Loader2 size={24} className="spin" style={{ color: 'var(--teal)', margin: '12px 0' }} />}
        <div className={`pin-display ${error ? 'error' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={currentPin.length > i ? 'filled' : ''}>
              {verifying && currentPin.length > i && <Loader2 size={16} className="spin" />}
            </span>
          ))}
        </div>
        {error && <p className="pin-error">{errorMsg}</p>}
        <div className="pin-keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} className="pin-key" onClick={() => press(d)}>{d}</button>
          ))}
          <button className="pin-key pin-key-action" onClick={() => {
            if (stage === 'confirm') setConfirmPin((p) => p.slice(0, -1));
            else setLocalPin((p) => p.slice(0, -1));
          }}>
            <Trash2 size={20} />
          </button>
          <button className="pin-key" onClick={() => press('0')}>0</button>
          {!settingPin && (
            <button className="pin-key pin-key-bio" onClick={onUnlock}>
              <Fingerprint size={24} />
            </button>
          )}
        </div>
        {!settingPin && (
          <button className="bio-action" onClick={onUnlock}>
            <Fingerprint size={20} /> {t('useBiometric', 'en')}
          </button>
        )}
      </div>
    </div>
  );
}

/* ============ SETUP SCREENS ============ */

function ProfileSetupScreen({
  role, onDone, onBack,
}: { role: Role; onDone: () => void; onBack: () => void }) {
  const { profile, updateProfile, uploadAvatar } = useApp();
  const [section, setSection] = useState(0);
  const [photo, setPhoto] = useState<string | null>(profile?.avatar_url || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    dob: profile?.dob || '',
    address: profile?.address || '',
    emergency_contact: profile?.emergency_contact || '',
    assigned_region: profile?.assigned_region || '',
    department: profile?.department || '',
    designation: profile?.designation || '',
    employee_id: profile?.employee_id || '',
    bio: profile?.bio || '',
    vehicle_type: '',
    registration: '',
    model: '',
    fuel_type: 'Diesel',
  });
  const isOfficer = role === 'officer';
  const sections = isOfficer
    ? ['Photo & Name', 'Contact & Department', 'Region & Bio']
    : ['Photo & Name', 'Contact & Bio', 'Vehicle Information'];
  const completion = Math.round(((section + 1) / sections.length) * 100);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhoto(URL.createObjectURL(file));
  };

  const update = (key: string, value: string) => setFormData((d) => ({ ...d, [key]: value }));

  const handleContinue = async () => {
    if (section < sections.length - 1) { setSection(section + 1); return; }
    setSaving(true);
    if (photoFile) await uploadAvatar(photoFile);
    await updateProfile({
      full_name: formData.full_name,
      phone: formData.phone,
      email: formData.email,
      dob: formData.dob || undefined,
      address: formData.address || undefined,
      emergency_contact: formData.emergency_contact || undefined,
      assigned_region: formData.assigned_region || undefined,
      department: formData.department || undefined,
      designation: formData.designation || undefined,
      employee_id: formData.employee_id || undefined,
      bio: formData.bio || undefined,
      profile_completion: 90,
    });
    setSaving(false);
    onDone();
  };

  return (
    <div className="auth-screen setup-screen">
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />
      <div className="auth-top-bar">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={20} /></button>
        <span className="setup-step">Step {section + 1} of {sections.length}</span>
      </div>
      <div className="setup-header">
        <h1>{isOfficer ? 'Officer Profile Setup' : 'Driver Profile Setup'}</h1>
        <div className="setup-progress"><div className="setup-progress-bar" style={{ width: `${completion}%` }} /></div>
        <p>Profile {completion}% Complete</p>
      </div>
      {section === 0 && (
        <div className="setup-section fade-in">
          <div className="photo-upload-area">
            <div className="photo-preview">
              {photo ? <img src={photo} alt="Profile" /> : <UserRound size={40} />}
            </div>
            <div className="photo-actions">
              <Button variant="outline" size="sm" leftIcon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>Upload Photo</Button>
              <Button variant="outline" size="sm" leftIcon={<Camera size={16} />} onClick={() => { if (fileRef.current) { fileRef.current.capture = 'user'; fileRef.current.click(); } }}>Take Photo</Button>
              {photo && <Button variant="ghost" size="sm" leftIcon={<Trash2 size={16} />} onClick={() => { setPhoto(null); setPhotoFile(null); }}>Remove</Button>}
            </div>
          </div>
          <Input label="Full Name" icon={<UserRound size={18} />} placeholder={isOfficer ? 'Aarav Mehta' : 'Rajesh Kumar'} value={formData.full_name} onChange={(v) => update('full_name', v)} required />
          {isOfficer ? (
            <Input label="Employee ID" icon={<ShieldCheck size={18} />} placeholder="FO-10842" value={formData.employee_id} onChange={(v) => update('employee_id', v)} />
          ) : (
            <Input label="Date of Birth" icon={<Calendar size={18} />} type="date" placeholder="DD/MM/YYYY" value={formData.dob} onChange={(v) => update('dob', v)} />
          )}
        </div>
      )}
      {section === 1 && (
        <div className="setup-section fade-in">
          <Input label="Phone Number" icon={<Phone size={18} />} placeholder="+91 98765 43210" value={formData.phone} onChange={(v) => update('phone', v)} />
          <Input label="Email" icon={<CircleUserRound size={18} />} type="email" placeholder="name@example.com" value={formData.email} onChange={(v) => update('email', v)} />
          {isOfficer ? (
            <>
              <Select label="Department" options={['Disaster Management', 'Field Operations', 'Safety & Compliance']} value={formData.department} onChange={(v) => update('department', v)} />
              <Select label="Designation" options={['Field Officer', 'Senior Officer', 'Coordinator']} value={formData.designation} onChange={(v) => update('designation', v)} />
            </>
          ) : (
            <>
              <Input label="Address" icon={<MapPin size={18} />} placeholder="House, Street, City" value={formData.address} onChange={(v) => update('address', v)} />
              <Input label="Emergency Contact" icon={<Phone size={18} />} placeholder="+91 98765 00000" value={formData.emergency_contact} onChange={(v) => update('emergency_contact', v)} />
            </>
          )}
        </div>
      )}
      {section === 2 && (
        <div className="setup-section fade-in">
          {isOfficer ? (
            <>
              <Input label="Assigned Region" icon={<MapPin size={18} />} placeholder="Assam & Meghalaya" value={formData.assigned_region} onChange={(v) => update('assigned_region', v)} />
              <Input label="Emergency Contact" icon={<Phone size={18} />} placeholder="+91 98765 00000" value={formData.emergency_contact} onChange={(v) => update('emergency_contact', v)} />
              <TextArea label="Short Bio" placeholder="Brief description of your role and experience…" value={formData.bio} onChange={(v) => update('bio', v)} />
            </>
          ) : (
            <>
              <Input label="Vehicle Type" icon={<Truck size={18} />} placeholder="Cargo Truck" value={formData.vehicle_type} onChange={(v) => update('vehicle_type', v)} />
              <Input label="Registration Number" icon={<FileText size={18} />} placeholder="TN XX XX XXXX" value={formData.registration} onChange={(v) => update('registration', v)} />
              <Input label="Vehicle Model" icon={<Truck size={18} />} placeholder="Tata 407" value={formData.model} onChange={(v) => update('model', v)} />
              <Select label="Fuel Type" options={['Diesel', 'Petrol', 'CNG', 'Electric']} value={formData.fuel_type} onChange={(v) => update('fuel_type', v)} />
            </>
          )}
        </div>
      )}
      <div className="setup-nav">
        {section > 0 && <Button variant="outline" onClick={() => setSection(section - 1)} leftIcon={<ArrowLeft size={18} />}>Back</Button>}
        {section < sections.length - 1 ? (
          <Button onClick={handleContinue} rightIcon={<ArrowRight size={18} />}>Continue</Button>
        ) : (
          <Button loading={saving} onClick={handleContinue} leftIcon={<Check size={18} />}>Complete Profile</Button>
        )}
      </div>
    </div>
  );
}

function VehicleInfoScreen({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const { profile, updateProfile, saveVehicle } = useApp();
  const [saving, setSaving] = useState(false);
  const [vehicleType, setVehicleType] = useState('Cargo Truck');
  const [registration, setRegistration] = useState('');
  const [model, setModel] = useState('');
  const [capacity, setCapacity] = useState('');
  const [weight, setWeight] = useState('');
  const [fuel, setFuel] = useState('Diesel');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!vehicleType.trim()) e.vehicleType = 'Vehicle type is required';
    if (!registration.trim()) {
      e.registration = 'Registration number is required';
    } else {
      // Indian vehicle number pattern: e.g. AS 01 AB 1234 or MH12AB1234
      const regPattern = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{4}$/i;
      if (!regPattern.test(registration.replace(/\s/g, '').toUpperCase())) {
        e.registration = 'Enter a valid vehicle registration (e.g. AS 01 AB 1234)';
      }
    }
    if (!model.trim()) e.model = 'Vehicle model is required';
    if (!capacity.trim()) {
      e.capacity = 'Capacity is required';
    } else {
      const cap = parseFloat(capacity);
      if (isNaN(cap) || cap <= 0) e.capacity = 'Capacity must be a positive number';
    }
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    await saveVehicle({
      vehicle_type: vehicleType,
      registration,
      model,
      capacity_tons: capacity ? parseFloat(capacity) : undefined,
      weight_kg: weight ? parseInt(weight) : undefined,
      fuel_type: fuel,
      vehicle_photo_url: photoUrl || undefined,
    });
    await updateProfile({ profile_completion: Math.min((profile?.profile_completion || 90) + 5, 100) });
    setSaving(false);
    onContinue();
  };

  return (
    <div className="app-screen">
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) setPhotoUrl(URL.createObjectURL(f));
      }} />
      <ScreenHeader title="Vehicle Information" subtitle="Register your vehicle for trip assignments" onBack={onBack} />
      <div className="screen-body">
        <Card className="vehicle-card">
          <div className="vehicle-photo-placeholder">
            {photoUrl ? (
              <img src={photoUrl} alt="Vehicle" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }} />
            ) : <Truck size={40} />}
            <Button variant="outline" size="sm" leftIcon={<Camera size={16} />} onClick={() => fileRef.current?.click()}>
              {photoUrl ? 'Change Photo' : 'Add Vehicle Photo'}
            </Button>
          </div>
          <div className="vehicle-info">
            <h3>{model || 'Your Vehicle'}</h3>
            <p className="vehicle-reg">{registration || 'Registration Number'}</p>
            <div className="vehicle-specs">
              <div><Truck size={16} /><span>{vehicleType}</span></div>
              <div><Package size={16} /><span>{capacity ? `${capacity} Tons` : '-- Tons'}</span></div>
              <div><Zap size={16} /><span>{fuel}</span></div>
            </div>
          </div>
        </Card>
        <div className="form-grid">
          <Input label="Vehicle Type *" icon={<Truck size={18} />} placeholder="Cargo Truck" value={vehicleType} onChange={setVehicleType} error={errors.vehicleType} required />
          <Input label="Registration Number *" icon={<FileText size={18} />} placeholder="AS 01 AB 1234" value={registration} onChange={setRegistration} error={errors.registration} required />
          <Input label="Vehicle Model *" icon={<Truck size={18} />} placeholder="Tata 407" value={model} onChange={setModel} error={errors.model} required />
          <Input label="Capacity (Tons) *" icon={<Package size={18} />} placeholder="2.5" value={capacity} onChange={setCapacity} error={errors.capacity} required />
          <Input label="Weight Capacity (kg)" icon={<Package size={18} />} placeholder="2500" value={weight} onChange={setWeight} />
          <Select label="Fuel Type" options={['Diesel', 'Petrol', 'CNG', 'Electric']} value={fuel} onChange={setFuel} />
        </div>
        <Card className="document-card">
          <div className="document-card-head">
            <h3><FileText size={18} /> Insurance & Documents</h3>
            <Button variant="ghost" size="sm" leftIcon={<Plus size={16} />} onClick={() => alert('Document upload: Tap to add insurance, RC and other documents.')}>Add</Button>
          </div>
          <div className="document-item">
            <span className="doc-icon"><FileText size={18} /></span>
            <div><strong>Vehicle Insurance</strong><small>Upload to verify</small></div>
            <Badge label="Pending" cls="badge-amber" />
          </div>
          <div className="document-item">
            <span className="doc-icon"><FileText size={18} /></span>
            <div><strong>Registration Certificate</strong><small>Upload to verify</small></div>
            <Badge label="Pending" cls="badge-amber" />
          </div>
        </Card>
      </div>
      <div className="sticky-cta">
        <Button full size="lg" loading={saving} onClick={handleSave}>Save & Continue</Button>
      </div>
    </div>
  );
}

function LocationPermissionScreen({ onAllow, onBack }: { onAllow: () => void; onBack: () => void }) {
  const { requestLocation, location } = useApp();
  const [requesting, setRequesting] = useState(false);

  const benefits = [
    { icon: <MapPin size={20} />, label: 'Live location sharing' },
    { icon: <Navigation size={20} />, label: 'Turn-by-turn navigation' },
    { icon: <Route size={20} />, label: 'Route monitoring' },
    { icon: <Siren size={20} />, label: 'Emergency alerts' },
    { icon: <AlertTriangle size={20} />, label: 'Disaster warnings' },
  ];

  const handleAllow = async () => {
    setRequesting(true);
    await requestLocation();
    setRequesting(false);
    onAllow();
  };

  return (
    <div className="auth-screen">
      <div className="auth-top-bar">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={20} /></button>
      </div>
      <div className="location-permission-content">
        <div className="location-illustration">
          <div className="location-illustration-ring" />
          <div className="location-illustration-ring location-illustration-ring-2" />
          <MapPin size={48} />
        </div>
        <h1>Enable Location Access</h1>
        <p className="location-desc">
          Location access helps us provide live tracking, navigation, route updates and safety alerts.
        </p>
        <div className="location-benefits">
          {benefits.map((b) => (
            <div key={b.label} className="location-benefit">
              <span>{b.icon}</span>
              <span>{b.label}</span>
            </div>
          ))}
        </div>
        {location.status === 'denied' && (
          <ErrorBanner message="Location permission denied. Please enable it in your browser settings and try again." />
        )}
      </div>
      <div className="auth-form">
        <Button full size="lg" loading={requesting} onClick={handleAllow} leftIcon={<MapPin size={18} />}>
          Allow Current Location
        </Button>
        <Button variant="ghost" full onClick={onAllow}>Not Now</Button>
      </div>
    </div>
  );
}

/* ============ DRIVER SCREENS ============ */

function DriverHome({
  onNavigate, onEmergency, onViewTrip,
}: {
  onNavigate: (s: Screen) => void; onEmergency: () => void; onViewTrip: (t: AppTrip) => void;
}) {
  const { profile, location, setLiveTracking, trips, incidents, language, unreadCount } = useApp();
  const [liveOn, setLiveOn] = useState(location.isLive);
  const [activeMarker, setActiveMarker] = useState<DisasterMarker | null>(null);
  const handleToggleLive = () => {
    const next = !liveOn;
    setLiveOn(next);
    setLiveTracking(next);
  };

  const currentTrip = trips.find((t) =>
    t.driver_id === profile?.id &&
    ['accepted', 'going_to_pickup', 'arrived_at_pickup', 'package_loaded', 'in_transit', 'arrived_at_destination'].includes(t.status)
  );

  // Convert incidents to DisasterMarker format for map, using real Haversine distances
  const disasterMarkers: DisasterMarker[] = incidents.slice(0, 8).map((inc, i) => ({
    id: inc.id,
    type: inc.type as IncidentType,
    label: inc.type,
    detail: inc.location_name || '',
    severity: inc.severity,
    timeReported: timeAgo(inc.created_at),
    distance: (location.lat && location.lng && inc.lat && inc.lng)
      ? `${haversineDistance(location.lat, location.lng, inc.lat, inc.lng).toFixed(1)} km away`
      : '-- km',
    action: inc.description || 'Exercise caution',
    top: `${20 + i * 15}%`,
    left: `${20 + i * 20}%`,
    lat: inc.lat ?? undefined,
    lng: inc.lng ?? undefined,
    variant: inc.severity === 'high' ? 'danger' : inc.severity === 'medium' ? 'warning' : 'advisory',
  }));

  return (
    <div className="app-screen">
      <OfflineBanner />
      <div className="role-header">
        <div className="role-header-user">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="Driver" className="role-header-avatar" />
            : <div className="role-header-avatar" style={{ background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserRound size={22} style={{ color: 'var(--teal)' }} /></div>
          }
          <div>
            <strong>{profile?.full_name || 'Driver'}</strong>
            <StatusDot variant={liveOn ? 'green' : 'amber'} label={t(liveOn ? 'online' : 'offline', language)} />
          </div>
        </div>
        <div className="role-header-actions">
          <button className="header-icon-btn" onClick={() => onNavigate('languageSettings')}><Languages size={20} /></button>
          <button className="header-icon-btn" onClick={() => onNavigate('driverAlerts')}>
            <Bell size={20} />
            {unreadCount > 0 && <i>{unreadCount > 9 ? '9+' : unreadCount}</i>}
          </button>
        </div>
      </div>

      <div className="home-map-wrap">
        <MapCanvas
          markers={disasterMarkers}
          onMarker={setActiveMarker}
          height="260px"
          userLat={location.lat}
          userLng={location.lng}
          userAccuracy={location.accuracy}
          pickupLat={currentTrip?.pickup_lat}
          pickupLng={currentTrip?.pickup_lng}
          destLat={currentTrip?.drop_lat}
          destLng={currentTrip?.drop_lng}
        />
        <button className="my-location-btn">
          <Crosshair size={16} />
          {location.lat ? `${location.lat.toFixed(4)}°N` : 'My Location'}
        </button>
      </div>

      <div className="screen-body">
        <Card className="live-status-card">
          <div className="live-status-top">
            <div>
              <span className="live-status-label">{t('liveLocation', language)}: {liveOn ? t('on', language) : t('off', language)}</span>
              <small>{t('sharingWith', language)}</small>
            </div>
            <Toggle on={liveOn} onChange={handleToggleLive} />
          </div>
          <div className="live-status-meta">
            <span>
              <Clock size={13} />
              {location.timestamp ? `Updated ${timeAgo(new Date(location.timestamp).toISOString())}` : 'Location not started'}
            </span>
            <span>
              <Crosshair size={13} />
              {location.accuracy ? `GPS ±${Math.round(location.accuracy)}m` : 'GPS inactive'}
            </span>
          </div>
          {location.status === 'denied' && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--red)', display: 'flex', gap: 4, alignItems: 'center' }}>
              <AlertTriangle size={12} /> Location permission denied. Enable in browser settings.
            </div>
          )}
        </Card>

        {currentTrip ? (
          <>
            <SectionHeader title={t('currentTrip', language)} />
            <Card className="current-trip-card" onClick={() => onViewTrip(currentTrip)}>
              <div className="current-trip-top">
                <Badge label="Active" cls="badge-teal" />
                <small>Trip #{currentTrip.trip_code}</small>
              </div>
              <h3>{currentTrip.product} — {currentTrip.quantity}</h3>
              <div className="trip-route-mini">
                <div className="trip-route-point"><MapPin size={14} /><span>{currentTrip.pickup_location}</span></div>
                <div className="trip-route-line" />
                <div className="trip-route-point trip-route-dest"><MapPin size={14} /><span>{currentTrip.drop_location}</span></div>
              </div>
              <div className="current-trip-meta">
                <span><Route size={14} /> {currentTrip.distance_km ? `${currentTrip.distance_km} km` : '--'}</span>
                <span><Clock size={14} /> {currentTrip.duration_mins ? `${Math.floor(currentTrip.duration_mins / 60)}h ${currentTrip.duration_mins % 60}m` : '--'}</span>
                <span><Package size={14} /> {currentTrip.capacity || '--'}</span>
              </div>
              <Button full size="sm" onClick={(e) => { e.stopPropagation(); onNavigate('navigation'); }} leftIcon={<Navigation size={16} />}>
                {t('continueNavigation', language)}
              </Button>
            </Card>
          </>
        ) : (
          <>
            <SectionHeader title="Available Trips" action="View all" onAction={() => onNavigate('driverTrips')} />
            {trips.filter((t) => t.status === 'available').slice(0, 2).map((trip) => (
              <Card key={trip.id} className="trip-request-card" style={{ marginBottom: 10 }}>
                <div className="trip-request-top">
                  <small>Trip #{trip.trip_code}</small>
                  <Badge label={priorityBadge[trip.priority].label} cls={priorityBadge[trip.priority].cls} />
                </div>
                <h3>{trip.product} — {trip.quantity}</h3>
                <div className="trip-request-actions">
                  <Button variant="outline" size="sm" onClick={() => onViewTrip(trip)}>View Details</Button>
                </div>
              </Card>
            ))}
            {trips.filter((t) => t.status === 'available').length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                No available trips at the moment.
              </div>
            )}
          </>
        )}

        <SectionHeader title={t('hazardAlerts', language)} action={t('viewMap', language)} onAction={() => onNavigate('driverMap')} />
        <div className="hazard-list">
          {disasterMarkers.slice(0, 2).map((m) => (
            <Card key={m.id} className="hazard-card" onClick={() => setActiveMarker(m)}>
              <span className={`hazard-icon marker-${m.variant}`}>
                {m.type === 'Landslide' ? '!' : m.type === 'Flood' ? '≈' : '°'}
              </span>
              <div>
                <strong>{m.label}</strong>
                <small>{m.distance} · {m.timeReported}</small>
              </div>
              <ChevronRight size={18} />
            </Card>
          ))}
          {disasterMarkers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No active hazard alerts.
            </div>
          )}
        </div>

        <button className="inline-emergency-btn" onClick={onEmergency}>
          <Siren size={18} /> {t('reportEmergency', language)}
        </button>
      </div>

      {activeMarker && <MarkerSheet marker={activeMarker} onClose={() => setActiveMarker(null)} />}
    </div>
  );
}

function DriverTripsScreen({
  onViewTrip, onBack,
}: { onViewTrip: (t: AppTrip) => void; onBack: () => void }) {
  const { trips, tripsLoading, refreshTrips, language } = useApp();
  const [filter, setFilter] = useState<'all' | 'normal' | 'priority' | 'urgent'>('all');
  const [search, setSearch] = useState('');

  const available = trips.filter((t) => t.status === 'available');
  const filtered = available.filter((t) => {
    const matchPriority = filter === 'all' || t.priority === filter;
    const matchSearch = !search || t.product.toLowerCase().includes(search.toLowerCase()) ||
      t.pickup_location.toLowerCase().includes(search.toLowerCase()) ||
      t.drop_location.toLowerCase().includes(search.toLowerCase());
    return matchPriority && matchSearch;
  });

  return (
    <div className="app-screen">
      <ScreenHeader
        title={t('availableTrips', language)}
        subtitle={`${available.length} delivery requests matching your vehicle`}
        onBack={onBack}
        right={
          <button className="header-icon-btn" onClick={refreshTrips} title="Refresh">
            <RefreshCw size={18} />
          </button>
        }
      />
      <div className="trip-summary-bar">
        <div><small>Open</small><strong>{available.length}</strong></div>
        <div><small>Urgent</small><strong>{available.filter((t) => t.priority === 'urgent').length}</strong></div>
        <div><small>Priority</small><strong>{available.filter((t) => t.priority === 'priority').length}</strong></div>
      </div>
      <div className="screen-body">
        <div style={{ marginBottom: 12 }}>
          <Input icon={<Search size={18} />} placeholder="Search trips, location…" value={search} onChange={setSearch} />
          <div className="alert-filters">
            {(['all', 'urgent', 'priority', 'normal'] as const).map((f) => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {tripsLoading ? <LoadingScreen message="Loading trips…" /> : (
          <div className="trip-list">
            {filtered.map((trip) => (
              <TripCard key={trip.id} trip={trip} onViewTrip={onViewTrip} />
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <Truck size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ margin: 0, fontSize: 14 }}>No trips match your filter.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TripCard({ trip, onViewTrip }: { trip: AppTrip; onViewTrip: (t: AppTrip) => void }) {
  const { acceptTrip, language, hasRequiredVehicle } = useApp();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [vehicleWarning, setVehicleWarning] = useState(false);

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasRequiredVehicle) {
      setVehicleWarning(true);
      return;
    }
    setVehicleWarning(false);
    setAccepting(true);
    const result = await acceptTrip(trip.id);
    setAccepting(false);
    if (result.success) {
      setAccepted(true);
    } else {
      alert(result.error || 'Failed to accept trip');
    }
  };

  if (accepted) {
    return (
      <Card className="trip-request-card" style={{ borderColor: 'var(--teal)', background: 'var(--teal-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--teal)', fontWeight: 700 }}>
          <Check size={20} /> Trip #{trip.trip_code} Accepted!
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--teal)' }}>Trip is now active. Navigate to pickup location.</p>
      </Card>
    );
  }

  return (
    <Card className="trip-request-card" onClick={() => onViewTrip(trip)}>
      <div className="trip-request-top">
        <small>Trip #{trip.trip_code}</small>
        <Badge label={priorityBadge[trip.priority].label} cls={priorityBadge[trip.priority].cls} />
      </div>
      <h3>{trip.product} — {trip.quantity}</h3>
      <div className="trip-locations">
        <div className="trip-loc">
          <span className="trip-loc-dot" />
          <div><small>Pickup</small><strong>{trip.pickup_location}</strong></div>
        </div>
        <div className="trip-loc">
          <span className="trip-loc-dot trip-loc-dot-dest" />
          <div><small>Drop</small><strong>{trip.drop_location}</strong></div>
        </div>
      </div>
      <div className="trip-request-meta">
        <span><Route size={13} /> {trip.distance_km ? `${trip.distance_km} km` : '--'}</span>
        <span><Clock size={13} /> {trip.duration_mins ? `${Math.floor(trip.duration_mins / 60)}h ${trip.duration_mins % 60}m` : '--'}</span>
        <span><Package size={13} /> {trip.capacity || '--'}</span>
      </div>
      {vehicleWarning && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <AlertTriangle size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
            <strong style={{ fontSize: 12, color: 'var(--amber)' }}>Vehicle details required</strong>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--amber)' }}>Please complete your vehicle details before accepting a trip.</p>
        </div>
      )}
      <div className="trip-request-actions">
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onViewTrip(trip); }}>{t('viewDetails', language)}</Button>
        <Button size="sm" loading={accepting} leftIcon={<Check size={15} />} onClick={handleAccept}>{t('acceptTrip', language)}</Button>
      </div>
    </Card>
  );
}

function TripDetailsScreen({
  trip, onAccept, onBack,
}: { trip: AppTrip; onAccept: () => void; onBack: () => void }) {
  const { acceptTrip, location, language, hasRequiredVehicle } = useApp();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!hasRequiredVehicle) {
      setError('Please complete your vehicle details before accepting a trip. Go to Profile → Vehicle Information.');
      return;
    }
    setAccepting(true);
    setError(null);
    const result = await acceptTrip(trip.id);
    setAccepting(false);
    if (result.success) onAccept();
    else setError(result.error || 'Failed to accept trip');
  };

  return (
    <div className="app-screen">
      <ScreenHeader
        title={`Trip #${trip.trip_code}`}
        onBack={onBack}
        right={<Badge label={priorityBadge[trip.priority].label} cls={priorityBadge[trip.priority].cls} />}
      />
      <div className="details-map-wrap">
        <MapCanvas
          height="220px"
          interactive={false}
          userLat={location.lat}
          userLng={location.lng}
          pickupLat={trip.pickup_lat}
          pickupLng={trip.pickup_lng}
          destLat={trip.drop_lat}
          destLng={trip.drop_lng}
        />
      </div>
      <div className="screen-body">
        {error && <ErrorBanner message={error} />}
        <Card className="details-card">
          <h3>{trip.product} — {trip.quantity}</h3>
          <div className="trip-locations">
            <div className="trip-loc">
              <span className="trip-loc-dot" />
              <div><small>Pickup</small><strong>{trip.pickup_location}</strong></div>
            </div>
            <div className="trip-loc">
              <span className="trip-loc-dot trip-loc-dot-dest" />
              <div><small>Destination</small><strong>{trip.drop_location}</strong></div>
            </div>
          </div>
        </Card>
        <div className="details-grid">
          <div className="detail-item"><Route size={16} /><div><small>Distance</small><strong>{trip.distance_km ? `${trip.distance_km} km` : '--'}</strong></div></div>
          <div className="detail-item"><Clock size={16} /><div><small>Est. Travel Time</small><strong>{trip.duration_mins ? `${Math.floor(trip.duration_mins / 60)}h ${trip.duration_mins % 60}m` : '--'}</strong></div></div>
          <div className="detail-item"><Package size={16} /><div><small>Vehicle Requirement</small><strong>{trip.capacity || '--'}</strong></div></div>
          <div className="detail-item"><Clock size={16} /><div><small>Priority</small><strong>{trip.priority}</strong></div></div>
        </div>
        {trip.instructions && (
          <Card className="info-card">
            <h4><FileText size={16} /> Special Instructions</h4>
            <p>{trip.instructions}</p>
          </Card>
        )}
        {trip.road_condition && (
          <Card className="info-card info-card-warning">
            <h4><AlertTriangle size={16} /> Current Road Conditions</h4>
            <p>{trip.road_condition}</p>
          </Card>
        )}
      </div>
      <div className="sticky-cta">
        {trip.status === 'available' ? (
          <Button full size="lg" loading={accepting} onClick={handleAccept} leftIcon={<Check size={18} />}>
            {t('acceptTrip', language)}
          </Button>
        ) : (
          <Button full size="lg" variant="outline" onClick={() => onBack()} leftIcon={<Navigation size={18} />}>
            Go to Navigation
          </Button>
        )}
      </div>
    </div>
  );
}

function ActiveTripTimeline({ trip, onStatusUpdate, onFinishTrip }: { trip: AppTrip; onStatusUpdate: (status: string) => void; onFinishTrip: () => void }) {
  const { updateTripStatus, finishTrip } = useApp();
  const [updating, setUpdating] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const stages = [
    { key: 'accepted', label: 'Trip Accepted', desc: 'Trip confirmed' },
    { key: 'going_to_pickup', label: 'Going to Pickup', desc: `En route to ${trip.pickup_location}` },
    { key: 'arrived_at_pickup', label: 'Arrived at Pickup', desc: 'Reached pickup location' },
    { key: 'package_loaded', label: 'Package Loaded', desc: `${trip.quantity} loaded and verified` },
    { key: 'in_transit', label: 'In Transit', desc: `Heading to ${trip.drop_location}` },
    { key: 'arrived_at_destination', label: 'Arrived at Destination', desc: 'Pending arrival' },
  ];

  const currentIdx = stages.findIndex((s) => s.key === trip.status);
  const nextStage = stages[currentIdx + 1];
  const isActiveTrip = stages.some((s) => s.key === trip.status);

  const handleNext = async () => {
    if (!nextStage) return;
    setUpdating(true);
    await updateTripStatus(trip.id, nextStage.key);
    onStatusUpdate(nextStage.key);
    setUpdating(false);
  };

  const handleFinish = async () => {
    setFinishing(true);
    setFinishError(null);
    const result = await finishTrip(trip.id);
    setFinishing(false);
    if (result.error) {
      setFinishError(result.error);
      setConfirmFinish(false);
    } else {
      onFinishTrip();
    }
  };

  return (
    <div className="screen-body">
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Trip #{trip.trip_code}</h3>
          <Badge label={trip.status.replace(/_/g, ' ')} cls="badge-teal" />
        </div>
        {stages.map((s, i) => (
          <div key={s.key} className="tl-item" style={{ paddingBottom: i < stages.length - 1 ? 24 : 0 }}>
            {i < stages.length - 1 && (
              <div className={`tl-conn${i < currentIdx ? ' done' : ''}`} />
            )}
            <div className={`tl-dot${i < currentIdx ? ' done' : ''}${i === currentIdx ? ' curr' : ''}`}
              style={i < currentIdx ? { background: 'var(--teal)', borderColor: 'var(--teal)', color: '#fff' } :
                i === currentIdx ? { background: 'var(--teal)', borderColor: 'var(--teal)', color: '#fff' } : {}}>
              {i < currentIdx ? <Check size={16} /> : i === currentIdx ? <Loader2 size={16} className="spin" /> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border)', display: 'block' }} />}
            </div>
            <div style={{ paddingTop: 8 }}>
              <strong style={{ fontSize: 13, display: 'block' }}>{s.label}</strong>
              <small style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.desc}</small>
            </div>
          </div>
        ))}
      </Card>

      {finishError && <ErrorBanner message={finishError} />}

      {confirmFinish ? (
        <Card style={{ border: '2px solid var(--teal)', background: 'var(--teal-light)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Check size={18} style={{ color: 'var(--teal)' }} />
            <strong style={{ color: 'var(--teal)' }}>Confirm Trip Completion</strong>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13 }}>Are you sure you want to finish this trip? This will record the delivery as complete.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" full onClick={() => setConfirmFinish(false)}>Cancel</Button>
            <Button size="sm" full loading={finishing} leftIcon={<Check size={15} />} onClick={handleFinish}>Finish Trip</Button>
          </div>
        </Card>
      ) : (
        <>
          {nextStage && (
            <Button full size="lg" loading={updating} onClick={handleNext} leftIcon={<ArrowRight size={18} />}>
              Mark: {nextStage.label}
            </Button>
          )}
          {isActiveTrip && (
            <Button
              full variant="danger" size="lg"
              style={{ marginTop: 8 }}
              onClick={() => setConfirmFinish(true)}
              leftIcon={<Check size={18} />}
            >
              Finish Trip
            </Button>
          )}
          {trip.status === 'completed' && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--teal)' }}>
              <Check size={40} />
              <p style={{ margin: '8px 0 0', fontWeight: 700 }}>Trip Completed!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NavigationScreen({
  onBack, onEmergency, onFinishTrip, trip, selectedRoute: initialSelectedRoute,
}: {
  onBack: () => void;
  onEmergency: () => void;
  onFinishTrip: () => void;
  trip?: AppTrip | null;
  selectedRoute?: RouteOption | null;
}) {
  const { location, language, speechSpeed, voiceGender, incidents } = useApp();
  const mapRef = useRef<MapViewRef>(null);

  // Active route state (calculated from OSRM if not passed)
  const [activeRoute, setActiveRoute] = useState<RouteOption | null>(initialSelectedRoute || null);
  const [loadingRoute, setLoadingRoute] = useState(!initialSelectedRoute);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Navigation / Simulation state
  const [navMode, setNavMode] = useState<'simulation' | 'gps'>('simulation');
  const [simStatus, setSimStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');
  const [simSpeed, setSimSpeed] = useState<number>(2); // 0.5x, 1x, 2x, 5x, 10x
  const [progressKm, setProgressKm] = useState<number>(0);
  const [vehiclePos, setVehiclePos] = useState<{ lat: number; lng: number; heading: number } | null>(null);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [voiceOn, setVoiceOn] = useState<boolean>(true);

  // Turn-by-turn steps & maneuvers
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [distToNextStepMeters, setDistToNextStepMeters] = useState<number>(0);
  const [showTimeline, setShowTimeline] = useState<boolean>(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState<boolean>(false);

  // ML-based Route Disaster Prediction & Alert State
  const [predictedHazards, setPredictedHazards] = useState<RouteHazard[]>([]);
  const [activeHazardAlert, setActiveHazardAlert] = useState<RouteHazard | null>(null);
  const [dismissedHazardIds, setDismissedHazardIds] = useState<Set<string>>(new Set());
  const [showAltRoutesModal, setShowAltRoutesModal] = useState<boolean>(false);
  const [candidateAltRoutes, setCandidateAltRoutes] = useState<RouteOption[]>([]);
  const [loadingAltRoutes, setLoadingAltRoutes] = useState<boolean>(false);
  const lastHazardCheckRef = useRef<{ time: number; km: number }>({ time: 0, km: -999 });
  const spokenHazardAnnouncementsRef = useRef<Set<string>>(new Set());

  // Anti-repeat voice announcement tracker
  const spokenAnnouncementsRef = useRef<Set<string>>(new Set());
  const lastAnimTimeRef = useRef<number | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Extract coordinates and cumulative distances along route geometry
  const routeCoords = useMemo(() => {
    if (activeRoute?.geometry && activeRoute.geometry.length > 1) {
      return activeRoute.geometry.map(([lng, lat]) => ({ lat, lng }));
    }
    if (trip?.pickup_lat && trip?.pickup_lng && trip?.drop_lat && trip?.drop_lng) {
      return [
        { lat: trip.pickup_lat, lng: trip.pickup_lng },
        { lat: trip.drop_lat, lng: trip.drop_lng },
      ];
    }
    return [];
  }, [activeRoute, trip]);

  const cumDistances = useMemo(() => {
    if (routeCoords.length < 2) return [0];
    const dists = [0];
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const d = haversineDistance(
        routeCoords[i].lat, routeCoords[i].lng,
        routeCoords[i + 1].lat, routeCoords[i + 1].lng
      );
      dists.push(dists[dists.length - 1] + d);
    }
    return dists;
  }, [routeCoords]);

  const totalDistKm = cumDistances[cumDistances.length - 1] || activeRoute?.distanceKm || 1;

  // Step cumulative distances
  const stepCumulativeKm = useMemo(() => {
    if (!activeRoute?.steps?.length) return [];
    let sum = 0;
    return activeRoute.steps.map((s) => {
      sum += s.distanceMeters / 1000;
      return sum;
    });
  }, [activeRoute]);

  // Helper to speak localized instruction
  const speakManeuverNotice = useCallback((text: string) => {
    if (!voiceOn) return;
    const rate = getRateForSetting(speechSpeed);
    speakInstruction(text, language, rate, voiceGender);
  }, [voiceOn, language, speechSpeed, voiceGender]);

  // Function to query ML prediction service for route ahead
  const refreshRoutePredictions = useCallback((vLat: number, vLng: number, currentKm: number) => {
    if (routeCoords.length < 2) return;
    const now = Date.now();
    // Throttle checks to once every 5 seconds or when moved > 1.5 km
    if (now - lastHazardCheckRef.current.time < 5000 && Math.abs(currentKm - lastHazardCheckRef.current.km) < 1.5) {
      return;
    }
    lastHazardCheckRef.current = { time: now, km: currentKm };

    fetchPredictedRouteHazards(vLat, vLng, routeCoords, 35.0)
      .then((hazards) => {
        setPredictedHazards(hazards);
      })
      .catch((err) => {
        console.warn('ML Prediction check error:', err);
      });
  }, [routeCoords]);

  // Calculate route if not provided
  useEffect(() => {
    if (initialSelectedRoute) {
      setActiveRoute(initialSelectedRoute);
      setLoadingRoute(false);
      return;
    }
    if (!trip?.pickup_lat || !trip?.pickup_lng || !trip?.drop_lat || !trip?.drop_lng) {
      setRouteError('Trip pickup and destination coordinates are missing.');
      setLoadingRoute(false);
      return;
    }

    setLoadingRoute(true);
    setRouteError(null);
    calculateRoutes(trip.pickup_lat, trip.pickup_lng, trip.drop_lat, trip.drop_lng, incidents)
      .then((r) => {
        if (r.length > 0) {
          setActiveRoute(r[0]);
        } else {
          setRouteError('Unable to calculate road route.');
        }
        setLoadingRoute(false);
      })
      .catch((err: Error) => {
        setRouteError(err.message || 'Unable to calculate road route.');
        setLoadingRoute(false);
      });
  }, [initialSelectedRoute, trip, incidents]);

  // Initial vehicle position at Trip Source / Pickup
  useEffect(() => {
    if (routeCoords.length > 0 && !vehiclePos) {
      const p0 = routeCoords[0];
      const p1 = routeCoords[1] || routeCoords[0];
      const initialHeading = calculateBearing(p0.lat, p0.lng, p1.lat, p1.lng);
      setVehiclePos({ lat: p0.lat, lng: p0.lng, heading: initialHeading });
      if (activeRoute?.steps?.[0]) {
        setDistToNextStepMeters(activeRoute.steps[0].distanceMeters);
      }
    }
  }, [routeCoords, vehiclePos, activeRoute]);

  // Initial and position-driven ML prediction check
  useEffect(() => {
    if (routeCoords.length > 0 && vehiclePos) {
      refreshRoutePredictions(vehiclePos.lat, vehiclePos.lng, progressKm);
    }
  }, [routeCoords, vehiclePos, progressKm, refreshRoutePredictions]);

  // Dynamic Hazard Distance & Voice Alert evaluation
  useEffect(() => {
    if (!vehiclePos || predictedHazards.length === 0) {
      setActiveHazardAlert(null);
      return;
    }

    let nearestAhead: RouteHazard | null = null;
    let minAheadDist = Infinity;

    predictedHazards.forEach((h) => {
      const dKm = haversineDistance(vehiclePos.lat, vehiclePos.lng, h.latitude, h.longitude);
      if (dKm <= 25.0 && dKm < minAheadDist) {
        minAheadDist = dKm;
        const stage = dKm <= 3.0 ? 'CRITICAL' : dKm <= 8.0 ? 'APPROACHING' : 'FAR';
        nearestAhead = {
          ...h,
          warning_level: stage,
          distance_ahead_km: Math.max(0.1, Math.round(dKm * 10) / 10),
        };
      }
    });

    if (nearestAhead && minAheadDist <= 20.0) {
      const typedHazard: RouteHazard = nearestAhead;
      setActiveHazardAlert(typedHazard);

      // Trigger localized voice warning for this warning stage
      const voiceKey = `${typedHazard.hazard_id}_${typedHazard.warning_level}`;
      if (!spokenHazardAnnouncementsRef.current.has(voiceKey) && voiceOn) {
        spokenHazardAnnouncementsRef.current.add(voiceKey);
        const voiceText = formatLocalizedHazardVoice(typedHazard, language);
        const rate = getRateForSetting(speechSpeed);
        speakInstruction(voiceText, language, rate, voiceGender);
      }
    } else {
      setActiveHazardAlert(null);
    }
  }, [vehiclePos, predictedHazards, voiceOn, language, speechSpeed, voiceGender]);

  // Simulation Controls
  const handleStartSim = () => {
    if (simStatus === 'completed') {
      setProgressKm(0);
      setCurrentStepIdx(0);
      spokenAnnouncementsRef.current.clear();
      spokenHazardAnnouncementsRef.current.clear();
      if (routeCoords[0]) {
        const h = routeCoords[1] ? calculateBearing(routeCoords[0].lat, routeCoords[0].lng, routeCoords[1].lat, routeCoords[1].lng) : 0;
        setVehiclePos({ lat: routeCoords[0].lat, lng: routeCoords[0].lng, heading: h });
      }
    }
    setSimStatus('running');
    setAutoFollow(true);
    lastAnimTimeRef.current = performance.now();
  };

  const handlePauseSim = () => {
    setSimStatus('paused');
    cancelSpeech();
  };

  const handleResetSim = () => {
    setSimStatus('idle');
    setProgressKm(0);
    setCurrentStepIdx(0);
    setDistToNextStepMeters(activeRoute?.steps?.[0]?.distanceMeters || 500);
    spokenAnnouncementsRef.current.clear();
    spokenHazardAnnouncementsRef.current.clear();
    setDismissedHazardIds(new Set());
    cancelSpeech();
    if (routeCoords[0]) {
      const h = routeCoords[1] ? calculateBearing(routeCoords[0].lat, routeCoords[0].lng, routeCoords[1].lat, routeCoords[1].lng) : 0;
      setVehiclePos({ lat: routeCoords[0].lat, lng: routeCoords[0].lng, heading: h });
      mapRef.current?.centerOnVehicle(routeCoords[0].lat, routeCoords[0].lng);
    }
  };

  // Main 60 FPS Simulation Animation Loop
  useEffect(() => {
    if (simStatus !== 'running' || navMode !== 'simulation' || routeCoords.length < 2) {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      lastAnimTimeRef.current = null;
      return;
    }

    const animate = (now: number) => {
      if (!lastAnimTimeRef.current) lastAnimTimeRef.current = now;
      const dt = Math.min((now - lastAnimTimeRef.current) / 1000, 0.1);
      lastAnimTimeRef.current = now;

      // Base simulated speed = 60 km/h
      const speedKmh = 60 * simSpeed;
      const deltaKm = (speedKmh / 3600) * dt;

      setProgressKm((prevKm) => {
        const nextKm = Math.min(totalDistKm, prevKm + deltaKm);

        // Find route segment
        let segIdx = 0;
        while (segIdx < cumDistances.length - 2 && cumDistances[segIdx + 1] < nextKm) {
          segIdx++;
        }

        const segStartKm = cumDistances[segIdx];
        const segEndKm = cumDistances[segIdx + 1] || totalDistKm;
        const segDist = segEndKm - segStartKm;
        const t = segDist > 0 ? (nextKm - segStartKm) / segDist : 0;
        const clampedT = Math.max(0, Math.min(1, t));

        const pA = routeCoords[segIdx];
        const pB = routeCoords[segIdx + 1] || pA;

        const curLat = pA.lat + clampedT * (pB.lat - pA.lat);
        const curLng = pA.lng + clampedT * (pB.lng - pA.lng);
        const curHeading = calculateBearing(pA.lat, pA.lng, pB.lat, pB.lng);

        setVehiclePos({ lat: curLat, lng: curLng, heading: curHeading });

        // Turn-by-Turn step detection
        if (activeRoute?.steps?.length) {
          let sIdx = 0;
          while (sIdx < stepCumulativeKm.length - 1 && stepCumulativeKm[sIdx] < nextKm + 0.015) {
            sIdx++;
          }
          setCurrentStepIdx(sIdx);

          const step = activeRoute.steps[sIdx];
          const distToM = Math.max(0, ((stepCumulativeKm[sIdx] || totalDistKm) - nextKm) * 1000);
          setDistToNextStepMeters(distToM);

          // Controlled voice triggers before maneuver
          const key500 = `${sIdx}_500m`;
          const key100 = `${sIdx}_100m`;

          if (distToM <= 550 && distToM > 250 && !spokenAnnouncementsRef.current.has(key500)) {
            spokenAnnouncementsRef.current.add(key500);
            const msg = formatLocalizedInstruction(step, distToM, language);
            speakManeuverNotice(msg);
          } else if (distToM <= 150 && distToM > 20 && !spokenAnnouncementsRef.current.has(key100)) {
            spokenAnnouncementsRef.current.add(key100);
            const msg = formatLocalizedInstruction(step, 0, language);
            speakManeuverNotice(msg);
          }
        }

        // Check if reached destination
        if (nextKm >= totalDistKm - 0.03) {
          setSimStatus('completed');
          if (!spokenAnnouncementsRef.current.has('destination_reached')) {
            spokenAnnouncementsRef.current.add('destination_reached');
            const arriveText = language === 'hi' ? 'गंतव्य पर पहुँच गए। आप यात्रा पूरी कर सकते हैं।'
              : language === 'as' ? 'গন্তব্যস্থানত উপনীত হ\'ল। আপুনি যাত্ৰা সম্পূৰ্ণ কৰিব পাৰে।'
              : language === 'bn' ? 'গন্তব্যে পৌঁছেছেন। আপনি ট্রিপ সম্পন্ন করতে পারেন।'
              : language === 'ta' ? 'இலக்கை அடைந்தீர்கள். பயணத்தை முடிக்கலாம்.'
              : language === 'te' ? 'గమ్యస్థానానికి చేరుకున్నారు. యాత్రను పూర్తి చేయవచ్చు.'
              : language === 'mr' ? 'मुक्कामावर पोहोचलात. आपण प्रवास पूर्ण करू शकता.'
              : 'Destination reached. You have arrived at your destination.';
            speakManeuverNotice(arriveText);
          }
          return totalDistKm;
        }

        return nextKm;
      });

      if (simStatus === 'running') {
        animFrameIdRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [simStatus, navMode, simSpeed, totalDistKm, routeCoords, cumDistances, stepCumulativeKm, activeRoute, language, speakManeuverNotice]);

  // Current active step & next step
  const currentStep = activeRoute?.steps?.[currentStepIdx] || (activeRoute?.steps ? activeRoute.steps[0] : null);
  const nextStep = activeRoute?.steps?.[currentStepIdx + 1] || null;

  // Stats calculation
  const progressPct = totalDistKm > 0 ? Math.min(100, Math.round((progressKm / totalDistKm) * 100)) : 0;
  const remainingKm = Math.max(0, totalDistKm - progressKm);
  const avgSpeedKmh = 50;
  const remainingMins = Math.round((remainingKm / avgSpeedKmh) * 60);
  const etaTime = new Date(Date.now() + remainingMins * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const simulatedSpeedGauge = simStatus === 'running' ? Math.round(52 + Math.sin(progressKm * 10) * 4) : 0;

  return (
    <div className="nav-screen">
      {/* Map view with simulated vehicle or GPS */}
      <div className="nav-map">
        <MapCanvas
          ref={mapRef}
          height="100%"
          interactive={true}
          userLat={navMode === 'gps' ? location.lat : null}
          userLng={navMode === 'gps' ? location.lng : null}
          userAccuracy={navMode === 'gps' ? location.accuracy : null}
          vehicleLat={navMode === 'simulation' ? vehiclePos?.lat : null}
          vehicleLng={navMode === 'simulation' ? vehiclePos?.lng : null}
          vehicleHeading={vehiclePos?.heading || 0}
          isSimulating={navMode === 'simulation'}
          autoFollowVehicle={autoFollow}
          onUserPan={() => setAutoFollow(false)}
          predictedHazards={predictedHazards}
          onHazardClick={(h) => setActiveHazardAlert(h)}
          pickupLat={trip?.pickup_lat}
          pickupLng={trip?.pickup_lng}
          destLat={trip?.drop_lat}
          destLng={trip?.drop_lng}
          routes={activeRoute ? [activeRoute] : undefined}
          selectedRouteIndex={0}
        />
      </div>

      {/* Top Bar: Back, Mode Switcher, Emergency */}
      <div className="nav-top-bar">
        <button className="nav-back-btn" onClick={onBack} title="Back to Driver Home">
          <ArrowLeft size={20} />
        </button>

        {/* Real GPS Mode vs Simulation Mode Pill */}
        <div className="nav-mode-pill">
          <button
            className={navMode === 'simulation' ? 'active' : ''}
            onClick={() => { setNavMode('simulation'); setAutoFollow(true); }}
          >
            <Truck size={13} /> Simulation Mode
          </button>
          <button
            className={navMode === 'gps' ? 'active' : ''}
            onClick={() => {
              setNavMode('gps');
              setSimStatus('paused');
              cancelSpeech();
            }}
          >
            <Crosshair size={13} /> Real GPS
          </button>
        </div>

        <button className="nav-emergency-btn" onClick={onEmergency} title="Emergency Alert">
          <Siren size={18} />
        </button>
      </div>

      {/* Floating Turn-by-Turn Card */}
      {activeRoute && currentStep && simStatus !== 'completed' && (
        <div className="nav-maneuver-card">
          <div className="nav-maneuver-main">
            <div className="nav-maneuver-icon-wrap">
              <ManeuverIcon type={currentStep.maneuverType} modifier={currentStep.maneuverModifier} />
            </div>
            <div className="nav-maneuver-info">
              <div className="nav-maneuver-distance">
                {distToNextStepMeters >= 1000
                  ? `${(distToNextStepMeters / 1000).toFixed(1)} km`
                  : `${Math.round(distToNextStepMeters)} m`}
              </div>
              <div className="nav-maneuver-text">
                {formatLocalizedInstruction(currentStep, 0, language)}
              </div>
            </div>
          </div>
          {nextStep && (
            <div className="nav-maneuver-next">
              <span style={{ opacity: 0.7 }}>Then:</span>
              <span>{nextStep.instruction}</span>
            </div>
          )}
        </div>
      )}

      {/* Floating ML Disaster Risk Alert Card */}
      {activeHazardAlert && simStatus !== 'completed' && !dismissedHazardIds.has(activeHazardAlert.hazard_id) && (
        <div className={`nav-hazard-alert-card ${activeHazardAlert.warning_level === 'CRITICAL' ? 'critical' : 'warning'}`}>
          <div className="nav-hazard-top">
            <div className="nav-hazard-badge">
              <AlertTriangle size={15} />
              <span>{activeHazardAlert.hazard_type.toUpperCase()} RISK DETECTED</span>
            </div>
            <div className="nav-hazard-dist">
              {activeHazardAlert.distance_ahead_km.toFixed(1)} km ahead
            </div>
            <button
              className="nav-hazard-close"
              title="Dismiss Alert"
              onClick={() => setDismissedHazardIds((prev) => new Set([...prev, activeHazardAlert.hazard_id]))}
            >
              <X size={14} />
            </button>
          </div>
          <div className="nav-hazard-msg">
            {activeHazardAlert.warning_message}
          </div>
          <div className="nav-hazard-action-row">
            <small>{activeHazardAlert.recommended_action}</small>
            <button
              className="nav-hazard-alt-btn"
              onClick={() => {
                if (trip?.pickup_lat && trip?.pickup_lng && trip?.drop_lat && trip?.drop_lng) {
                  setLoadingAltRoutes(true);
                  calculateRoutes(trip.pickup_lat, trip.pickup_lng, trip.drop_lat, trip.drop_lng, incidents)
                    .then((r) => {
                      setCandidateAltRoutes(r);
                      setLoadingAltRoutes(false);
                      setShowAltRoutesModal(true);
                    })
                    .catch(() => {
                      setLoadingAltRoutes(false);
                      setShowAltRoutesModal(true);
                    });
                }
              }}
            >
              View Alternative Routes
            </button>
          </div>
        </div>
      )}

      {/* Bottom Panel */}
      <div className="nav-bottom-panel">
        {/* Loading / Error States */}
        {loadingRoute && <LoadingScreen message="Calculating OSRM road route…" />}
        {routeError && (
          <div style={{ background: 'var(--red-light)', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 14px' }}>
            <strong style={{ color: 'var(--red)', fontSize: 13 }}>Route Notice</strong>
            <p style={{ margin: '4px 0 8px', fontSize: 12, color: 'var(--red)' }}>{routeError}</p>
            <Button size="sm" onClick={() => {
              setLoadingRoute(true);
              setRouteError(null);
              if (trip?.pickup_lat && trip?.pickup_lng && trip?.drop_lat && trip?.drop_lng) {
                calculateRoutes(trip.pickup_lat, trip.pickup_lng, trip.drop_lat, trip.drop_lng, incidents)
                  .then((r) => { if (r.length > 0) setActiveRoute(r[0]); setLoadingRoute(false); })
                  .catch((e) => { setRouteError(e.message); setLoadingRoute(false); });
              }
            }}>Retry Route Calculation</Button>
          </div>
        )}

        {/* Voice status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {voiceOn ? (
            <div className="nav-voice-indicator">
              <div className="nav-voice-wave"><span /><span /><span /><span /></div>
              <small>{t('voiceAssistantActive', language)} ({language.toUpperCase()})</small>
            </div>
          ) : (
            <small style={{ color: 'var(--text-muted)' }}>Voice guidance muted</small>
          )}
          <button
            style={{ background: 'none', border: 'none', color: voiceOn ? 'var(--teal)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
            onClick={() => {
              const next = !voiceOn;
              setVoiceOn(next);
              if (!next) cancelSpeech();
            }}
          >
            {voiceOn ? <Volume2 size={16} /> : <MicOff size={16} />}
            {voiceOn ? 'Mute' : 'Enable Voice'}
          </button>
        </div>

        {/* Simulation Controls Toolbar (when in Simulation Mode) */}
        {navMode === 'simulation' && (
          <div className="sim-toolbar">
            <div className="sim-toolbar-top">
              {simStatus === 'running' ? (
                <button className="sim-action-btn pause" onClick={handlePauseSim}>
                  <Pause size={15} /> Pause
                </button>
              ) : (
                <button className="sim-action-btn play" onClick={handleStartSim}>
                  <Play size={15} /> {simStatus === 'paused' ? 'Resume' : 'Start Simulation'}
                </button>
              )}

              <button className="sim-action-btn reset" onClick={handleResetSim} title="Reset to Start">
                <RotateCcw size={14} /> Reset
              </button>

              <div className="sim-speed-group">
                <span className="sim-speed-label">Speed:</span>
                {[0.5, 1, 2, 5, 10].map((s) => (
                  <button
                    key={s}
                    className={`sim-speed-btn ${simSpeed === s ? 'active' : ''}`}
                    onClick={() => setSimSpeed(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {!autoFollow && (
              <button
                style={{ background: 'var(--teal-light)', border: '1px solid var(--teal)', borderRadius: 8, padding: '4px 10px', color: 'var(--teal)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}
                onClick={() => {
                  setAutoFollow(true);
                  if (vehiclePos) mapRef.current?.centerOnVehicle(vehiclePos.lat, vehiclePos.lng);
                }}
              >
                <Crosshair size={13} /> Re-center Camera on Vehicle
              </button>
            )}
          </div>
        )}

        {/* Progress Bar */}
        <div className="nav-progress-wrap">
          <div className="nav-progress-labels">
            <span>Trip Progress</span>
            <span>{progressPct}% ({progressKm.toFixed(1)} / {totalDistKm.toFixed(1)} km)</span>
          </div>
          <div className="nav-progress-track">
            <div className="nav-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="nav-stats-grid">
          <div>
            <small>Speed</small>
            <strong>{navMode === 'simulation' ? simulatedSpeedGauge : 45} km/h</strong>
          </div>
          <div>
            <small>Remaining</small>
            <strong>{remainingKm.toFixed(1)} km</strong>
          </div>
          <div>
            <small>ETA</small>
            <strong>{etaTime}</strong>
          </div>
        </div>

        {/* Destination Reached Banner */}
        {simStatus === 'completed' && (
          <div className="destination-reached-card">
            <h3>🎉 Destination Reached!</h3>
            <p>You have successfully arrived at {trip?.drop_location || 'the destination point'}.</p>
            <Button
              full
              size="lg"
              onClick={() => setShowFinishConfirm(true)}
              leftIcon={<Check size={18} />}
              style={{ background: '#ffffff', color: '#047857', fontWeight: 800 }}
            >
              Finish Trip Now
            </Button>
          </div>
        )}

        {/* Finish Trip / Timeline buttons */}
        {trip && simStatus !== 'completed' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onClick={() => setShowTimeline(!showTimeline)}
              leftIcon={<ClipboardList size={15} />}
            >
              Timeline
            </Button>
            <Button
              variant="danger"
              size="sm"
              style={{ flex: 1 }}
              onClick={() => setShowFinishConfirm(true)}
              leftIcon={<Check size={15} />}
            >
              Finish Trip
            </Button>
          </div>
        )}

        {/* Finish Trip Confirmation Dialog */}
        {showFinishConfirm && trip && (
          <Card style={{ background: 'var(--card)', border: '2px solid var(--teal)', padding: 14 }}>
            <strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Confirm Finish Trip</strong>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
              Are you sure you want to complete Trip #{trip.trip_code}?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="sm" style={{ flex: 1 }} onClick={() => setShowFinishConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowFinishConfirm(false);
                  onFinishTrip();
                }}
              >
                Confirm Complete
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Trip Timeline Modal */}
      {showTimeline && trip && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 35, overflowY: 'auto' }}
          onClick={() => setShowTimeline(false)}
        >
          <div
            style={{ marginTop: 80, background: 'var(--bg)', borderRadius: '20px 20px 0 0', minHeight: '60vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Trip Timeline</h3>
              <button onClick={() => setShowTimeline(false)}><X size={20} /></button>
            </div>
            <ActiveTripTimeline
              trip={trip}
              onStatusUpdate={() => setShowTimeline(false)}
              onFinishTrip={() => { setShowTimeline(false); onFinishTrip(); }}
            />
          </div>
        </div>
      )}

      {/* Alternative Routes Switcher Modal (triggered when Hazard Ahead is detected) */}
      {showAltRoutesModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={() => setShowAltRoutesModal(false)}
        >
          <div
            style={{ background: 'var(--bg)', borderRadius: '24px 24px 0 0', maxHeight: '78vh', overflowY: 'auto', padding: '18px 18px 24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Alternative Routes</h3>
                <small style={{ color: 'var(--text-muted)' }}>Choose a safer route to avoid predicted hazard</small>
              </div>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                onClick={() => setShowAltRoutesModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            {loadingAltRoutes && <LoadingScreen message="Evaluating alternative OSRM routes…" />}

            {!loadingAltRoutes && candidateAltRoutes.map((r) => {
              const isCurrent = r.id === activeRoute?.id;
              return (
                <Card
                  key={r.id}
                  className={`route-option-card ${isCurrent ? 'route-selected' : ''}`}
                  style={{ marginBottom: 10, cursor: 'pointer' }}
                  onClick={() => {
                    setActiveRoute(r);
                    setShowAltRoutesModal(false);
                    spokenAnnouncementsRef.current.clear();
                    spokenHazardAnnouncementsRef.current.clear();
                    if (r.geometry && r.geometry.length > 1) {
                      const h = calculateBearing(r.geometry[0][1], r.geometry[0][0], r.geometry[1][1], r.geometry[0][0]);
                      setVehiclePos({ lat: r.geometry[0][1], lng: r.geometry[0][0], heading: h });
                    }
                  }}
                >
                  <div className="route-option-top">
                    <div>
                      <strong className="route-label">{r.label} {isCurrent ? '(Active)' : ''}</strong>
                      <small style={{ color: 'var(--text-muted)', display: 'block' }}>{r.notes}</small>
                    </div>
                    <Badge
                      label={r.riskLevel === 'low' ? 'Safe' : r.riskLevel === 'medium' ? 'Caution' : 'Risky'}
                      cls={r.riskLevel === 'low' ? 'badge-teal' : r.riskLevel === 'medium' ? 'badge-amber' : 'badge-red'}
                    />
                  </div>
                  <div className="route-option-stats">
                    <div><Route size={14} /><span>{r.distanceKm} km</span></div>
                    <div><Clock size={14} /><span>{formatDuration(r.durationMins)}</span></div>
                    <div style={{ color: r.riskLevel === 'low' ? 'var(--teal)' : 'var(--amber)' }}>
                      <Activity size={14} /><span>Safety: {r.safetyScore}/100</span>
                    </div>
                  </div>
                  <div className="route-option-condition">
                    <small>{r.roadCondition}</small>
                  </div>
                  {!isCurrent && (
                    <Button size="sm" style={{ marginTop: 8 }} full>
                      Switch to This Route
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ PROXIMITY ALERT BANNER ============ */

function ProximityAlertBanner({ onEmergency }: { onEmergency: () => void }) {
  const { nearbyHazards, alertedHazardIds, dismissHazardAlert, language, speechSpeed } = useApp();
  const unalerted = nearbyHazards.filter((h) => !alertedHazardIds.has(h.id));
  if (unalerted.length === 0) return null;
  const top = unalerted[0];

  const handleDismiss = () => {
    dismissHazardAlert(top.id);
    const rate = getRateForSetting(speechSpeed);
    speakDisasterWarning(top.type, top.location_name || 'your area', language, rate);
  };

  return (
    <div className="proximity-alert-banner">
      <AlertTriangle size={20} className="proximity-alert-icon" />
      <div className="proximity-alert-body">
        <strong>{top.type} Nearby</strong>
        <small>{top.location_name || 'Hazard detected near your location'}</small>
      </div>
      <div className="proximity-alert-actions">
        <button className="proximity-dismiss-btn" onClick={handleDismiss}>OK</button>
        <button className="proximity-emergency-btn" onClick={onEmergency}><Siren size={14} /></button>
      </div>
    </div>
  );
}

/* ============ ROUTE SELECTION ============ */

function RouteSelectionScreen({
  trip, onSelectRoute, onNoSafeRoute, onBack,
}: { trip: AppTrip; onSelectRoute: (route: RouteOption) => void; onNoSafeRoute: () => void; onBack: () => void }) {
  const { incidents, location } = useApp();
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapPreviewIdx, setMapPreviewIdx] = useState(0);

  useEffect(() => {
    if (!trip.pickup_lat || !trip.pickup_lng || !trip.drop_lat || !trip.drop_lng) {
      setError('Route coordinates not available for this trip.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    calculateRoutes(trip.pickup_lat, trip.pickup_lng, trip.drop_lat, trip.drop_lng, incidents)
      .then((r) => { setRoutes(r); setLoading(false); if (r.length > 0) { setSelected(r[0].id); setMapPreviewIdx(0); } })
      .catch((err: Error) => { setError(err.message || 'Could not calculate routes.'); setLoading(false); });
  }, [trip, incidents]);

  const allUnsafe = routes.length > 0 && routes.every((r) => r.safetyScore < 30);
  const riskColor = (level: string) => level === 'low' ? 'var(--teal)' : level === 'medium' ? 'var(--amber)' : 'var(--red)';
  const riskBadge = (level: string) => level === 'low' ? 'badge-teal' : level === 'medium' ? 'badge-amber' : 'badge-red';

  return (
    <div className="app-screen">
      <ScreenHeader title="Select Route" subtitle="Choose your route based on safety and distance" onBack={onBack} />
      {/* Map preview showing all route options */}
      {routes.length > 0 && (
        <div style={{ height: 200, flexShrink: 0 }}>
          <MapCanvas
            height="200px"
            interactive={false}
            userLat={location.lat}
            userLng={location.lng}
            pickupLat={trip.pickup_lat}
            pickupLng={trip.pickup_lng}
            destLat={trip.drop_lat}
            destLng={trip.drop_lng}
            routes={routes}
            selectedRouteIndex={mapPreviewIdx}
          />
        </div>
      )}
      <div className="screen-body">
        {loading && <LoadingScreen message="Calculating routes…" />}
        {error && (
          <div style={{ marginBottom: 16 }}>
            <ErrorBanner message={error} />
            <Button
              size="sm"
              style={{ marginTop: 8 }}
              onClick={() => {
                if (!trip.pickup_lat || !trip.pickup_lng || !trip.drop_lat || !trip.drop_lng) return;
                setLoading(true);
                setError(null);
                calculateRoutes(trip.pickup_lat, trip.pickup_lng, trip.drop_lat, trip.drop_lng, incidents)
                  .then((r) => { setRoutes(r); setLoading(false); if (r.length > 0) { setSelected(r[0].id); setMapPreviewIdx(0); } })
                  .catch((err: Error) => { setError(err.message || 'Could not calculate routes.'); setLoading(false); });
              }}
            >
              Retry Route Calculation
            </Button>
          </div>
        )}
        {!loading && (
          <>
            {allUnsafe && (
              <div style={{ background: 'var(--red-light)', border: '1px solid #f3b7b1', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                <AlertTriangle size={20} style={{ color: 'var(--red)', flexShrink: 0 }} />
                <div>
                  <strong style={{ color: 'var(--red)', fontSize: 13 }}>All Routes Unsafe</strong>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--red)' }}>Consider finding a safe halt location instead of continuing.</p>
                </div>
              </div>
            )}
            {routes.map((r, idx) => (
              <Card
                key={r.id}
                className={`route-option-card ${selected === r.id ? 'route-selected' : ''}`}
                onClick={() => { setSelected(r.id); setMapPreviewIdx(idx); }}
              >
                <div className="route-option-top">
                  <div>
                    <strong className="route-label">{r.label}</strong>
                    <small style={{ color: 'var(--text-muted)', display: 'block' }}>{r.notes}</small>
                  </div>
                  <Badge label={r.riskLevel === 'low' ? 'Safe' : r.riskLevel === 'medium' ? 'Caution' : 'Risky'} cls={riskBadge(r.riskLevel)} />
                </div>
                <div className="route-option-stats">
                  <div><Route size={14} /><span>{r.distanceKm} km</span></div>
                  <div><Clock size={14} /><span>{formatDuration(r.durationMins)}</span></div>
                  <div style={{ color: riskColor(r.riskLevel) }}>
                    <Activity size={14} /><span>Safety: {r.safetyScore}/100</span>
                  </div>
                </div>
                <div className="route-option-condition">
                  <small>{r.roadCondition}</small>
                  {r.incidentsOnRoute.length > 0 && (
                    <small style={{ color: 'var(--red)' }}>{r.incidentsOnRoute.length} hazard{r.incidentsOnRoute.length > 1 ? 's' : ''} on route</small>
                  )}
                </div>
                {selected === r.id && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--teal)', fontSize: 12, fontWeight: 600 }}>
                    <Check size={14} /> Selected
                  </div>
                )}
              </Card>
            ))}
          </>
        )}
      </div>
      <div className="sticky-cta">
        {allUnsafe ? (
          <Button full size="lg" variant="danger" onClick={onNoSafeRoute} leftIcon={<ParkingSquare size={18} />}>
            Find Safe Halt
          </Button>
        ) : (
          <>
            <Button full size="lg" disabled={!selected} onClick={() => {
              const route = routes.find((r) => r.id === selected);
              if (route) onSelectRoute(route);
            }} leftIcon={<Navigation size={18} />}>
              Start Navigation
            </Button>
            {allUnsafe && (
              <Button full variant="outline" onClick={onNoSafeRoute} leftIcon={<ParkingSquare size={18} />} style={{ marginTop: 8 }}>
                No Safe Route — Find Safe Halt
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NoSafeRouteScreen({
  trip, onSelectHalt, onBack,
}: { trip: AppTrip | null; onSelectHalt: (halt: SafeHalt) => void; onBack: () => void }) {
  const { location, incidents } = useApp();
  const [halts, setHalts] = useState<SafeHalt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lat = location.lat || trip?.pickup_lat || 26.1445;
    const lng = location.lng || trip?.pickup_lng || 91.7362;
    findSafeHalts(lat, lng, incidents)
      .then((h) => { setHalts(h); setLoading(false); })
      .catch(() => setLoading(false));
  }, [location, trip, incidents]);

  const haltIcon = (type: SafeHalt['type']) => {
    if (type === 'fuel_station') return <Fuel size={18} />;
    if (type === 'hotel' || type === 'motel') return <Hotel size={18} />;
    if (type === 'truck_stop') return <Truck size={18} />;
    if (type === 'shelter') return <TreePine size={18} />;
    return <ParkingSquare size={18} />;
  };

  return (
    <div className="app-screen">
      <ScreenHeader title="Safe Halt Locations" subtitle="Find a safe place to wait out conditions" onBack={onBack} />
      <div className="screen-body">
        <div style={{ background: 'var(--amber-light)', border: '1px solid #fcd34d', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <AlertTriangle size={16} style={{ color: 'var(--amber)' }} />
            <strong style={{ fontSize: 13, color: 'var(--amber)' }}>No Safe Route Available</strong>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--amber)' }}>Current road conditions make travel unsafe. Please select a safe halt location below and wait for conditions to improve.</p>
        </div>
        {loading && <LoadingScreen message="Finding nearby safe locations…" />}
        {!loading && halts.map((h) => (
          <Card key={h.id} className="safe-halt-card" onClick={() => onSelectHalt(h)}>
            <span className={`safe-halt-icon ${h.riskLevel === 'low' ? 'halt-icon-green' : h.riskLevel === 'medium' ? 'halt-icon-amber' : 'halt-icon-red'}`}>
              {haltIcon(h.type)}
            </span>
            <div className="safe-halt-info">
              <strong>{h.name}</strong>
              <small>{h.type.replace(/_/g, ' ')} · {h.distanceKm} km away</small>
              {h.address && <small style={{ color: 'var(--text-muted)' }}>{h.address}</small>}
              {h.amenities.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {h.amenities.map((a) => <span key={a} style={{ fontSize: 10, background: 'var(--teal-light)', color: 'var(--teal)', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>{a}</span>)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <Badge label={h.riskLevel === 'low' ? 'Safe' : h.riskLevel === 'medium' ? 'Monitor' : 'Risky'} cls={h.riskLevel === 'low' ? 'badge-teal' : h.riskLevel === 'medium' ? 'badge-amber' : 'badge-red'} />
              <Navigation size={16} style={{ color: 'var(--teal)' }} />
            </div>
          </Card>
        ))}
        {!loading && halts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <ParkingSquare size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>No safe halts found nearby. Please contact emergency services.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ OFFICER SCREENS ============ */

function OfficerHome({
  onNavigate, onEmergency,
}: { onNavigate: (s: Screen) => void; onEmergency: () => void }) {
  const { profile, location, setLiveTracking, incidents, notifications: notifs, language, unreadCount } = useApp();
  const [activeMarker, setActiveMarker] = useState<DisasterMarker | null>(null);
  const [locOn, setLocOn] = useState(location.isLive);

  const handleToggleLoc = () => {
    const next = !locOn;
    setLocOn(next);
    setLiveTracking(next);
  };

  const disasterMarkers: DisasterMarker[] = incidents.slice(0, 8).map((inc, i) => ({
    id: inc.id,
    type: inc.type as IncidentType,
    label: inc.type,
    detail: inc.location_name || '',
    severity: inc.severity,
    timeReported: timeAgo(inc.created_at),
    distance: (inc.lat && location.lat && location.lng)
      ? `${haversineDistance(location.lat, location.lng, inc.lat, inc.lng ?? 0).toFixed(1)} km away`
      : '-- km',
    action: inc.description || 'Field verification required',
    top: `${20 + i * 15}%`,
    left: `${20 + i * 20}%`,
    lat: inc.lat ?? undefined,
    lng: inc.lng ?? undefined,
    variant: inc.severity === 'high' ? 'danger' : inc.severity === 'medium' ? 'warning' : 'advisory',
  }));

  const criticalAlerts = notifs.filter((n) => !n.read && n.priority === 'critical').slice(0, 2);

  const quickActions = [
    { label: t('reportIncident', language), desc: 'Log a new field situation', icon: <AlertTriangle size={22} />, screen: 'incidentReport' as Screen, primary: true },
    { label: t('uploadEvidence', language), desc: 'Photos, videos and notes', icon: <Upload size={22} />, screen: 'evidenceUpload' as Screen },
    { label: t('emergency', language), desc: 'Send an urgent alert', icon: <Siren size={22} />, action: 'emergency', red: true },
    { label: t('myReports', language), desc: 'Review submitted reports', icon: <FolderOpen size={22} />, screen: 'officerReports' as Screen },
  ];

  return (
    <div className="app-screen">
      <OfflineBanner />
      <div className="role-header">
        <div className="role-header-user">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="Officer" className="role-header-avatar" />
            : <div className="role-header-avatar" style={{ background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShieldCheck size={22} style={{ color: 'var(--navy)' }} /></div>
          }
          <div>
            <strong>{profile?.full_name || 'Field Officer'}</strong>
            <StatusDot variant="green" label={locOn ? t('onDuty', language) : t('offDuty', language)} />
          </div>
        </div>
        <div className="role-header-actions">
          <button className="header-icon-btn" onClick={() => onNavigate('languageSettings')}><Languages size={20} /></button>
          <button className="header-icon-btn" onClick={() => onNavigate('officerAlerts')}>
            <Bell size={20} />
            {unreadCount > 0 && <i>{unreadCount > 9 ? '9+' : unreadCount}</i>}
          </button>
        </div>
      </div>

      <div className="home-map-wrap">
        <MapCanvas markers={disasterMarkers} onMarker={setActiveMarker} height="280px" userLat={location.lat} userLng={location.lng} />
        <div className="location-status-chip">
          <StatusDot variant={locOn ? 'green' : 'amber'} label={`Location: ${locOn ? 'ON' : 'OFF'}`} />
          <Toggle on={locOn} onChange={handleToggleLoc} />
        </div>
      </div>

      <div className="screen-body">
        <SectionHeader title="Quick Actions" />
        <div className="quick-actions-grid">
          {quickActions.map((a) => (
            <button
              key={a.label}
              className={`quick-action-card ${a.primary ? 'primary' : ''} ${a.red ? 'red' : ''}`}
              onClick={() => a.action === 'emergency' ? onEmergency() : onNavigate(a.screen!)}
            >
              <span className={`quick-action-icon ${a.red ? 'red-icon' : ''}`}>{a.icon}</span>
              <div>
                <strong>{a.label}</strong>
                <small>{a.desc}</small>
              </div>
            </button>
          ))}
        </div>

        <SectionHeader title={t('activeAlerts', language)} action="View all" onAction={() => onNavigate('officerAlerts')} />
        <div className="alert-list">
          {criticalAlerts.length > 0 ? criticalAlerts.map((n) => (
            <Card key={n.id} className={`alert-card ${n.priority === 'critical' ? 'alert-critical' : 'alert-warning'}`}>
              <AlertTriangle size={20} />
              <div>
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                <small>{n.priority.toUpperCase()} · {timeAgo(n.created_at)}</small>
              </div>
            </Card>
          )) : (
            <Card className="alert-card">
              <CloudRain size={20} />
              <div><strong>No critical alerts</strong><p>All clear in your area.</p></div>
            </Card>
          )}
        </div>

        <SectionHeader title="Nearby Field Operations" />
        <div className="ops-list">
          <Card className="ops-card">
            <span className="ops-icon ops-icon-teal"><Users size={18} /></span>
            <div><strong>{Math.floor(Math.random() * 5 + 1)} Drivers nearby</strong><small>Within 15 km radius</small></div>
            <ChevronRight size={18} />
          </Card>
          <Card className="ops-card">
            <span className="ops-icon ops-icon-amber"><AlertTriangle size={18} /></span>
            <div><strong>{incidents.filter((i) => i.status === 'under_review').length} Active incidents</strong><small>Under field verification</small></div>
            <ChevronRight size={18} />
          </Card>
        </div>
      </div>

      {activeMarker && <MarkerSheet marker={activeMarker} onClose={() => setActiveMarker(null)} />}
    </div>
  );
}

function EvidenceUploadScreen({ onSubmit, onBack }: { onSubmit: () => void; onBack: () => void }) {
  const { location, profile, submitIncident, requestLocation } = useApp();
  const [files, setFiles] = useState<{ id: number; name: string; type: 'photo' | 'video'; url: string; file: File }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null, type: 'photo' | 'video') => {
    if (!newFiles) return;
    const added = Array.from(newFiles).map((file, i) => ({
      id: Date.now() + i,
      name: file.name,
      type: type,
      url: URL.createObjectURL(file),
      file,
    }));
    setFiles((f) => [...f, ...added]);
  };

  const handleSubmit = async () => {
    if (files.length === 0) { setError('Please select at least one photo or video.'); return; }
    if (!location.lat || !location.lng) {
      setError('Unable to determine your current location. Please enable location access and try again.');
      return;
    }
    setError(null);
    setUploading(true);
    const result = await submitIncident(
      {
        type: 'Other',
        severity: 'medium',
        lat: location.lat,
        lng: location.lng,
        location_name: `${location.lat.toFixed(4)}°N, ${location.lng.toFixed(4)}°E`,
        description: 'Evidence uploaded by Field Officer.',
      },
      files.map((f) => f.file),
    );
    setUploading(false);
    if (result.error) { setError(result.error); return; }
    onSubmit();
  };

  return (
    <div className="app-screen">
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files, 'photo')} />
      <input ref={videoRef} type="file" accept="video/*" style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files, 'video')} />
      <ScreenHeader title="Upload Evidence" subtitle="Attach photos and videos to an incident" onBack={onBack} />
      <div className="screen-body">
        <div className="upload-options-row">
          <button className="upload-option-btn" onClick={() => { if (fileRef.current) { fileRef.current.capture = 'environment'; fileRef.current.accept = 'image/*'; fileRef.current.click(); } }}>
            <Camera size={22} /><span>Take Photo</span>
          </button>
          <button className="upload-option-btn" onClick={() => { if (videoRef.current) { videoRef.current.capture = 'environment'; videoRef.current.click(); } }}>
            <Video size={22} /><span>Record Video</span>
          </button>
          <button className="upload-option-btn" onClick={() => fileRef.current?.click()}>
            <Image size={22} /><span>From Gallery</span>
          </button>
        </div>
        <div className="upload-dropzone" onClick={() => fileRef.current?.click()}>
          <Upload size={28} />
          <strong>Drop files here or tap to browse</strong>
          <small>JPG, PNG, MP4 · up to 50 MB per file</small>
        </div>
        {files.length > 0 && (
          <>
            <SectionHeader title={`Uploaded Files (${files.length})`} />
            <div className="upload-preview-list">
              {files.map((u) => (
                <Card key={u.id} className="upload-preview-card">
                  <div className="upload-preview-thumb">
                    {u.type === 'video'
                      ? <Video size={20} />
                      : <img src={u.url} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                    }
                  </div>
                  <div className="upload-preview-info">
                    <strong>{u.name}</strong>
                    <div className="upload-preview-meta">
                      <span><MapPin size={11} /> {location.lat ? `${location.lat.toFixed(4)}°N` : 'No GPS'}</span>
                      <span><Clock size={11} /> {new Date().toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <button className="upload-remove-btn" onClick={() => setFiles(files.filter((x) => x.id !== u.id))}><X size={16} /></button>
                </Card>
              ))}
            </div>
          </>
        )}
        <Card className="evidence-meta-card">
          <h4><FileText size={16} /> Auto-Attached Metadata</h4>
          <div className="evidence-meta-grid">
            <div><small>GPS Location</small><strong>{location.lat ? `${location.lat.toFixed(4)}°N, ${location.lng?.toFixed(4)}°E` : 'Not available'}</strong></div>
            <div><small>Timestamp</small><strong>{new Date().toLocaleString()}</strong></div>
            <div><small>Field Officer</small><strong>{profile?.full_name || 'Officer'} · {profile?.employee_id || '--'}</strong></div>
            <div><small>Files</small><strong>{files.length} file{files.length !== 1 ? 's' : ''} selected</strong></div>
          </div>
        </Card>
      </div>
      <div className="sticky-cta">
        {error && <ErrorBanner message={error} />}
        <Button full size="lg" loading={uploading} onClick={handleSubmit} leftIcon={<Check size={18} />}>
          Submit Evidence
        </Button>
      </div>
    </div>
  );
}

function IncidentReportScreen({ onSubmit, onBack }: { onSubmit: (code: string) => void; onBack: () => void }) {
  const { location, submitIncident, language, requestLocation } = useApp();
  const [incidentType, setIncidentType] = useState(incidentCategories[0]);
  const [severity, setSeverity] = useState('High');
  const [description, setDescription] = useState('');
  const [peopleAffected, setPeopleAffected] = useState('0');
  const [roadCondition, setRoadCondition] = useState('Passable');
  const [vehicleAccess, setVehicleAccess] = useState('Accessible');
  const [recommendedAction, setRecommendedAction] = useState('Monitor');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!description.trim()) { setError('Please add a description.'); return; }
    if (!location.lat || !location.lng) {
      setError('GPS location is required to submit an incident report. Please enable location access and try again.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await submitIncident({
      type: incidentType,
      severity: severity.toLowerCase() as 'low' | 'medium' | 'high',
      lat: location.lat,
      lng: location.lng,
      location_name: `${location.lat.toFixed(4)}°N, ${location.lng.toFixed(4)}°E`,
      description,
      people_affected: parseInt(peopleAffected) || 0,
      road_condition: roadCondition,
      vehicle_accessibility: vehicleAccess,
      recommended_action: recommendedAction,
    }, mediaFiles);
    setSubmitting(false);
    if (result.error) { setError(result.error); return; }
    onSubmit(result.code || 'INC-XXXX');
  };

  return (
    <div className="app-screen">
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) setMediaFiles((f) => [...f, ...Array.from(e.target.files!)]);
        }} />
      <ScreenHeader title={t('createReport', language)} subtitle="Document a field situation" onBack={onBack} />
      <div className="screen-body">
        {error && <ErrorBanner message={error} />}
        <Card className="mini-map-card">
          <MapCanvas height="160px" interactive={false} userLat={location.lat} userLng={location.lng} />
          <div className="mini-map-overlay">
            <MapPin size={16} />
            {location.lat
              ? <span>{location.lat.toFixed(4)}°N, {location.lng?.toFixed(4)}°E</span>
              : <span style={{ color: 'var(--red)', fontWeight: 600 }}>GPS not available — enable location access</span>
            }
          </div>
        </Card>
        <Select label={t('incidentType', language)} options={incidentCategories} value={incidentType} onChange={(v) => setIncidentType(v as IncidentType)} />
        <Select label={t('severity', language)} options={['High', 'Medium', 'Low']} value={severity} onChange={setSeverity} />
        <Input
          label={t('location', language)}
          icon={<MapPin size={18} />}
          placeholder={location.lat ? `${location.lat.toFixed(4)}°N, ${location.lng?.toFixed(4)}°E` : 'Enable GPS for auto-location'}
          value={location.lat ? `${location.lat.toFixed(4)}°N, ${location.lng?.toFixed(4)}°E` : ''}
        />
        <Input label="Date & Time" icon={<Calendar size={18} />} value={new Date().toLocaleString()} />
        <TextArea label={t('description', language)} placeholder="Describe what you observe at the site…" value={description} onChange={setDescription} />
        <div className="form-grid-2">
          <Input label="People Affected" icon={<Users size={18} />} placeholder="0" value={peopleAffected} onChange={setPeopleAffected} />
          <Select label="Road Condition" options={['Passable', 'Partially Blocked', 'Impassable']} value={roadCondition} onChange={setRoadCondition} />
        </div>
        <Select label="Vehicle Accessibility" options={['Accessible', 'Restricted', 'Blocked']} value={vehicleAccess} onChange={setVehicleAccess} />
        <Select label="Recommended Action" options={['Monitor', 'Divert Traffic', 'Evacuate', 'Close Road']} value={recommendedAction} onChange={setRecommendedAction} />
        <div className="report-attach-row">
          <button className="report-attach-btn" onClick={() => fileRef.current?.click()}>
            <Camera size={18} /><span>{t('addPhotos', language)} {mediaFiles.filter((f) => f.type.startsWith('image')).length > 0 ? `(${mediaFiles.filter((f) => f.type.startsWith('image')).length})` : ''}</span>
          </button>
          <button className="report-attach-btn" onClick={() => fileRef.current?.click()}>
            <Video size={18} /><span>{t('addVideos', language)} {mediaFiles.filter((f) => f.type.startsWith('video')).length > 0 ? `(${mediaFiles.filter((f) => f.type.startsWith('video')).length})` : ''}</span>
          </button>
        </div>
      </div>
      <div className="sticky-cta">
        <Button full size="lg" loading={submitting} onClick={handleSubmit} leftIcon={<Check size={18} />}>
          {t('submitReport', language)}
        </Button>
      </div>
    </div>
  );
}

function ReportConfirmationScreen({
  onDone, onView, onBack, reportCode,
}: { onDone: () => void; onView: () => void; onBack: () => void; reportCode?: string }) {
  const checkProgress = useProgress(1200);
  const code = reportCode || 'INC-XXXXX';
  return (
    <div className="auth-screen confirmation-screen">
      <div className="auth-top-bar">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={20} /></button>
      </div>
      <div className="confirmation-content">
        <div className="confirmation-check">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#d8f7f1" strokeWidth="4" />
            <circle
              cx="40" cy="40" r="36" fill="none" stroke="#006a61" strokeWidth="4"
              strokeDasharray={226} strokeDashoffset={226 - (226 * checkProgress) / 100}
              strokeLinecap="round" transform="rotate(-90 40 40)"
            />
          </svg>
          {checkProgress >= 100 && <Check size={32} className="confirmation-check-icon" />}
        </div>
        <h1>Report Submitted Successfully</h1>
        <Card className="confirmation-card">
          <div className="confirmation-row"><small>Report ID</small><strong>{code}</strong></div>
          <div className="confirmation-row"><small>Submitted</small><strong>{new Date().toLocaleString()}</strong></div>
          <div className="confirmation-row"><small>Location</small><strong>GPS coordinates attached</strong></div>
          <div className="confirmation-row confirmation-status"><small>Status</small><Badge label="Under Review" cls="badge-amber" /></div>
        </Card>
        <Button full size="lg" variant="outline" onClick={onView} leftIcon={<FileText size={18} />}>View Report</Button>
        <Button full size="lg" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

/* ============ CITIZEN SCREENS ============ */

function CitizenHome({
  onNavigate, onEmergency,
}: { onNavigate: (s: Screen) => void; onEmergency: () => void }) {
  const { profile, citizenSubmissions, notifications: notifs, unreadCount, incidents, location } = useApp();
  const [activeMarker, setActiveMarker] = useState<DisasterMarker | null>(null);

  // Citizen-visible disasters: nearby incidents sorted by distance (no driver/trip data)
  const nearbyDisasters: DisasterMarker[] = incidents
    .filter((inc) => inc.lat && inc.lng)
    .map((inc, i) => ({
      id: inc.id,
      type: inc.type as IncidentType,
      label: inc.type,
      detail: inc.location_name || inc.description || '',
      severity: inc.severity,
      timeReported: timeAgo(inc.created_at),
      distance: (location.lat && location.lng)
        ? `${haversineDistance(location.lat, location.lng, inc.lat!, inc.lng!).toFixed(1)} km away`
        : '-- km',
      action: 'Stay informed and follow local authority guidance.',
      top: `${20 + i * 15}%`,
      left: `${20 + i * 20}%`,
      lat: inc.lat ?? undefined,
      lng: inc.lng ?? undefined,
      variant: inc.severity === 'high' ? 'danger' : inc.severity === 'medium' ? 'warning' : 'advisory',
    }))
    .sort((a, b) => {
      const da = parseFloat(a.distance);
      const db = parseFloat(b.distance);
      if (isNaN(da) || isNaN(db)) return 0;
      return da - db;
    })
    .slice(0, 5);

  const recentSubs = citizenSubmissions.slice(0, 3);
  const statusLabel: Record<string, string> = {
    submitted: 'Under Review', under_review: 'Under Review',
    verified: 'Verified', resolved: 'Resolved',
  };
  const statusCls: Record<string, string> = {
    submitted: 'badge-amber', under_review: 'badge-amber',
    verified: 'badge-teal', resolved: 'badge-neutral',
  };

  return (
    <div className="app-screen">
      <OfflineBanner />
      <div className="role-header citizen-header">
        <div className="role-header-user">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="Citizen" className="role-header-avatar" />
            : <div className="role-header-avatar citizen-avatar"><UserCheck size={22} /></div>
          }
          <div>
            <strong>{profile?.full_name || 'Citizen'}</strong>
            <span style={{ fontSize: 11, color: 'var(--citizen)', opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--citizen)', display: 'inline-block' }} />
              Active Reporter
            </span>
          </div>
        </div>
        <div className="role-header-actions">
          <button className="header-icon-btn" onClick={() => onNavigate('citizenProfile')}>
            <Bell size={20} />
            {unreadCount > 0 && <i>{unreadCount > 9 ? '9+' : unreadCount}</i>}
          </button>
        </div>
      </div>

      {/* Nearby Disaster Map — citizen-visible only, no driver/logistics data */}
      <div className="home-map-wrap">
        <MapCanvas
          markers={nearbyDisasters}
          onMarker={setActiveMarker}
          height="220px"
          userLat={location.lat}
          userLng={location.lng}
        />
        <div style={{ position: 'absolute', bottom: 8, left: 12, background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
          <MapPin size={11} /> {nearbyDisasters.length} nearby incident{nearbyDisasters.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="citizen-hero">
        <div className="citizen-hero-text">
          <h2>Report What You See</h2>
          <p>Your observations help disaster response teams protect communities.</p>
        </div>
        <Button
          full size="lg"
          onClick={() => onNavigate('citizenUpload')}
          leftIcon={<Camera size={20} />}
          style={{ background: 'var(--citizen)', border: 'none', marginTop: 16 }}
        >
          Upload Evidence
        </Button>
      </div>

      <div className="screen-body">
        <div className="citizen-action-grid">
          <button className="citizen-action-card" onClick={() => onNavigate('citizenUpload')}>
            <span className="citizen-action-icon upload-icon"><Upload size={24} /></span>
            <strong>Upload</strong>
            <small>Photo or Video</small>
          </button>
          <button className="citizen-action-card" onClick={() => onNavigate('citizenSubmissions')}>
            <span className="citizen-action-icon submissions-icon"><ClipboardList size={24} /></span>
            <strong>My Reports</strong>
            <small>{citizenSubmissions.length} submitted</small>
          </button>
          <button className="citizen-action-card emergency-action" onClick={onEmergency}>
            <span className="citizen-action-icon emergency-icon"><Siren size={24} /></span>
            <strong>Emergency</strong>
            <small>Report urgent</small>
          </button>
          <button className="citizen-action-card" onClick={() => onNavigate('citizenProfile')}>
            <span className="citizen-action-icon profile-icon"><UserRound size={24} /></span>
            <strong>Profile</strong>
            <small>My account</small>
          </button>
        </div>

        {recentSubs.length > 0 && (
          <>
            <SectionHeader title="Recent Submissions" action="View all" onAction={() => onNavigate('citizenSubmissions')} />
            {recentSubs.map((s) => (
              <Card key={s.id} className="citizen-sub-card">
                <span className="citizen-sub-icon"><FileText size={16} /></span>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 13 }}>{s.incident_type || 'Field Observation'}</strong>
                  <small style={{ display: 'block', color: 'var(--text-muted)' }}>{s.submission_code} · {timeAgo(s.created_at)}</small>
                </div>
                <Badge label={statusLabel[s.status] || s.status} cls={statusCls[s.status] || 'badge-neutral'} />
              </Card>
            ))}
          </>
        )}

        {nearbyDisasters.length > 0 && (
          <>
            <SectionHeader title="Nearby Disasters" />
            {nearbyDisasters.slice(0, 3).map((m) => (
              <Card key={m.id} className="hazard-card" onClick={() => setActiveMarker(m)}>
                <span className={`hazard-icon marker-${m.variant}`}>
                  {m.type === 'Landslide' ? '!' : m.type === 'Flood' ? '≈' : '°'}
                </span>
                <div>
                  <strong>{m.label}</strong>
                  <small>{m.distance} · {m.timeReported}</small>
                </div>
                <ChevronRight size={18} />
              </Card>
            ))}
          </>
        )}

        <Card style={{ padding: '16px', background: 'var(--citizen-light)', border: '1px solid var(--citizen-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={20} style={{ color: 'var(--citizen)', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: 13, color: 'var(--citizen)' }}>Your Privacy is Protected</strong>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--citizen)', opacity: 0.8 }}>Your submissions are only used for disaster response. Personal data is never shared publicly.</p>
            </div>
          </div>
        </Card>
      </div>

      {activeMarker && <MarkerSheet marker={activeMarker} onClose={() => setActiveMarker(null)} />}
    </div>
  );
}

function CitizenUploadScreen({ onSubmit, onBack }: { onSubmit: (code: string) => void; onBack: () => void }) {
  const { location, submitCitizenMedia, requestLocation } = useApp();
  const [files, setFiles] = useState<{ id: number; name: string; mediaType: 'photo' | 'video'; url: string; file: File }[]>([]);
  const [description, setDescription] = useState('');
  const [incidentType, setIncidentType] = useState(incidentCategories[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null, type: 'photo' | 'video') => {
    if (!newFiles) return;
    const added = Array.from(newFiles)
      .filter((f) => f.size <= 50 * 1024 * 1024) // 50MB limit
      .map((file, i) => ({
        id: Date.now() + i,
        name: file.name,
        mediaType: type,
        url: URL.createObjectURL(file),
        file,
      }));
    setFiles((f) => [...f, ...added]);
  };

  const handleSubmit = async () => {
    if (files.length === 0) { setError('Please select at least one photo or video.'); return; }
    setError(null);
    setSubmitting(true);
    const result = await submitCitizenMedia(
      files.map((f) => f.file),
      description,
      incidentType,
    );
    setSubmitting(false);
    if (result.error) { setError(result.error); return; }
    onSubmit(result.code || 'SUB-XXXXX');
  };

  return (
    <div className="app-screen">
      <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files, 'photo')} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files, 'video')} />
      <ScreenHeader title="Upload Evidence" subtitle="Share what you observe in the field" onBack={onBack} />
      <div className="screen-body">
        {error && <ErrorBanner message={error} />}
        <div className="upload-options-row">
          <button className="upload-option-btn citizen-upload-btn" onClick={() => { if (fileRef.current) { fileRef.current.capture = 'environment'; fileRef.current.click(); } }}>
            <Camera size={22} /><span>Take Photo</span>
          </button>
          <button className="upload-option-btn citizen-upload-btn" onClick={() => { if (videoRef.current) { videoRef.current.capture = 'environment'; videoRef.current.click(); } }}>
            <Video size={22} /><span>Record Video</span>
          </button>
          <button className="upload-option-btn citizen-upload-btn" onClick={() => fileRef.current?.click()}>
            <Image size={22} /><span>Gallery</span>
          </button>
        </div>

        {files.length > 0 && (
          <div className="citizen-media-grid">
            {files.map((u) => (
              <div key={u.id} className="citizen-media-item">
                {u.mediaType === 'photo'
                  ? <img src={u.url} alt={u.name} />
                  : <div className="citizen-video-thumb"><Video size={24} /></div>
                }
                <button className="citizen-media-remove" onClick={() => setFiles(files.filter((x) => x.id !== u.id))}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}

        {files.length === 0 && (
          <div className="upload-dropzone citizen-dropzone" onClick={() => fileRef.current?.click()}>
            <Camera size={32} style={{ opacity: 0.4 }} />
            <strong>Tap to add photos or videos</strong>
            <small>Max 50 MB per file</small>
          </div>
        )}

        <Select label="What are you reporting?" options={incidentCategories as unknown as string[]} value={incidentType} onChange={(v) => setIncidentType(v as IncidentType)} />
        <TextArea label="Description (optional)" placeholder="Describe what you see — location, conditions, severity…" value={description} onChange={setDescription} />

        <Card className="citizen-gps-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MapPin size={18} style={{ color: location.lat ? 'var(--citizen)' : 'var(--text-muted)' }} />
              <div>
                <strong style={{ fontSize: 13 }}>GPS Location</strong>
                <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                  {location.lat ? `${location.lat.toFixed(4)}°N, ${location.lng?.toFixed(4)}°E` : 'Not available — tap to enable'}
                </small>
              </div>
            </div>
            {!location.lat && (
              <Button size="sm" variant="outline" onClick={requestLocation} leftIcon={<Crosshair size={14} />}>Enable</Button>
            )}
            {location.lat && <Check size={18} style={{ color: 'var(--citizen)' }} />}
          </div>
        </Card>
      </div>
      <div className="sticky-cta">
        <Button full size="lg" loading={submitting} onClick={handleSubmit}
          style={{ background: 'var(--citizen)', border: 'none' }}
          leftIcon={<Send size={18} />}
        >
          Submit Report
        </Button>
      </div>
    </div>
  );
}

function CitizenSubmissionsScreen({ onBack }: { onBack: () => void }) {
  const { citizenSubmissions, citizenSubmissionsLoading, refreshCitizenSubmissions } = useApp();

  const statusLabel: Record<string, string> = {
    submitted: 'Under Review', under_review: 'Under Review',
    verified: 'Verified', resolved: 'Resolved',
  };
  const statusCls: Record<string, string> = {
    submitted: 'badge-amber', under_review: 'badge-amber',
    verified: 'badge-teal', resolved: 'badge-neutral',
  };

  return (
    <div className="app-screen">
      <ScreenHeader
        title="My Submissions"
        subtitle={`${citizenSubmissions.length} report${citizenSubmissions.length !== 1 ? 's' : ''} submitted`}
        onBack={onBack}
        right={<button className="header-icon-btn" onClick={refreshCitizenSubmissions}><RefreshCw size={18} /></button>}
      />
      <div className="screen-body">
        {citizenSubmissionsLoading && <LoadingScreen message="Loading submissions…" />}
        {!citizenSubmissionsLoading && citizenSubmissions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <ClipboardList size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>No Submissions Yet</h3>
            <p style={{ margin: 0, fontSize: 13 }}>Your evidence reports will appear here after you submit them.</p>
          </div>
        )}
        {citizenSubmissions.map((s) => (
          <Card key={s.id} className="citizen-sub-detail-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <strong style={{ fontSize: 14 }}>{s.incident_type || 'Field Observation'}</strong>
                <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 2 }}>{s.submission_code}</small>
              </div>
              <Badge label={statusLabel[s.status] || s.status} cls={statusCls[s.status] || 'badge-neutral'} />
            </div>
            {s.description && <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-secondary)' }}>{s.description}</p>}
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              {s.lat && <span><MapPin size={11} /> {s.lat.toFixed(3)}°N</span>}
              <span><Clock size={11} /> {timeAgo(s.created_at)}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CitizenProfileScreen({ onBack }: { onBack: () => void }) {
  const { profile, updateProfile, uploadAvatar, logout } = useApp();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    await updateProfile({ full_name: name, phone });
    setSaving(false);
    setEditing(false);
  };

  const handleAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadAvatar(file);
  };

  return (
    <div className="app-screen">
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatar} />
      <ScreenHeader title="My Profile" onBack={onBack} right={<button className="header-icon-btn" onClick={() => setEditing(!editing)}><Settings size={20} /></button>} />
      <div className="screen-body">
        <div className="profile-hero">
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="Profile" className="profile-hero-avatar" />
              : <div className="profile-hero-avatar citizen-avatar-large"><UserCheck size={32} /></div>
            }
            <div style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, background: 'var(--citizen)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
              <Camera size={10} style={{ color: '#fff' }} />
            </div>
          </div>
          <div className="profile-hero-info">
            <h2>{profile?.full_name || 'Citizen'}</h2>
            <p style={{ color: 'var(--citizen)', fontSize: 13 }}>Community Reporter</p>
          </div>
        </div>

        <Card className="profile-info-card">
          <div className="profile-card-head">
            <h3><CircleUserRound size={18} /> Personal Information</h3>
            <Button variant="ghost" size="sm" leftIcon={<Settings size={14} />} onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel' : 'Edit'}
            </Button>
          </div>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <Input label="Full Name" icon={<UserRound size={18} />} value={name} onChange={setName} />
              <Input label="Phone" icon={<Phone size={18} />} value={phone} onChange={setPhone} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                <Button loading={saving} onClick={handleSave} leftIcon={<Check size={16} />}>Save</Button>
              </div>
            </div>
          ) : (
            <div className="profile-fields">
              <div><small>Name</small><strong>{profile?.full_name || '--'}</strong></div>
              <div><small>Email</small><strong>{profile?.email || '--'}</strong></div>
              <div><small>Phone</small><strong>{profile?.phone || '--'}</strong></div>
            </div>
          )}
        </Card>

        <div style={{ marginTop: 8, marginBottom: 24 }}>
          <Button variant="danger" full onClick={() => { if (window.confirm('Are you sure you want to logout?')) logout(); }}>
            <ArrowLeft size={16} /> Logout
          </Button>
        </div>
      </div>
    </div>
  );
}

function CitizenConfirmationScreen({ code, onDone }: { code: string; onDone: () => void }) {
  const checkProgress = useProgress(1200);
  return (
    <div className="auth-screen confirmation-screen">
      <div className="confirmation-content">
        <div className="confirmation-check">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#dbeafe" strokeWidth="4" />
            <circle cx="40" cy="40" r="36" fill="none" stroke="var(--citizen)" strokeWidth="4"
              strokeDasharray={226} strokeDashoffset={226 - (226 * checkProgress) / 100}
              strokeLinecap="round" transform="rotate(-90 40 40)"
            />
          </svg>
          {checkProgress >= 100 && <Check size={32} className="confirmation-check-icon" style={{ color: 'var(--citizen)' }} />}
        </div>
        <h1>Thank You!</h1>
        <p style={{ color: 'var(--text-muted)', margin: '8px 0 24px' }}>Your evidence report has been received. It will help disaster response teams protect your community.</p>
        <Card className="confirmation-card">
          <div className="confirmation-row"><small>Submission ID</small><strong>{code}</strong></div>
          <div className="confirmation-row"><small>Submitted</small><strong>{new Date().toLocaleString()}</strong></div>
          <div className="confirmation-row"><small>Location</small><strong>GPS coordinates attached</strong></div>
          <div className="confirmation-row confirmation-status"><small>Status</small><Badge label="Under Review" cls="badge-amber" /></div>
        </Card>
        <Button full size="lg" onClick={onDone} style={{ background: 'var(--citizen)', border: 'none' }}>Done</Button>
      </div>
    </div>
  );
}

/* ============ SHARED SCREENS ============ */

function AlertsScreen({
  onBack, role,
}: { onBack: () => void; role: Role }) {
  const { notifications: items, markRead, markAllRead, language } = useApp();
  const [filter, setFilter] = useState<'all' | 'critical' | 'advisory'>('all');
  const filtered = items.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'critical') return n.priority === 'critical' || n.priority === 'high';
    return n.priority === 'normal';
  });

  const categoryIcon = (cat: AppNotification['category']) => {
    if (cat === 'emergency' || cat === 'disaster') return <AlertTriangle size={18} />;
    if (cat === 'trip') return <Truck size={18} />;
    if (cat === 'navigation') return <Navigation size={18} />;
    if (cat === 'report') return <FileText size={18} />;
    return <Bell size={18} />;
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="app-screen">
      <ScreenHeader
        title="Alert Center"
        subtitle="All notifications and alerts"
        onBack={onBack}
        right={
          unread > 0 ? (
            <button
              onClick={markAllRead}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--teal)' }}
            >
              <CheckCheck size={16} /> Mark all read
            </button>
          ) : undefined
        }
      />
      <div className="screen-body">
        <div className="alert-filters">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All <b>{items.length}</b></button>
          <button className={filter === 'critical' ? 'active' : ''} onClick={() => setFilter('critical')}>Critical <b>{items.filter((n) => n.priority === 'critical' || n.priority === 'high').length}</b></button>
          <button className={filter === 'advisory' ? 'active' : ''} onClick={() => setFilter('advisory')}>Advisory <b>{items.filter((n) => n.priority === 'normal').length}</b></button>
        </div>
        <div className="alert-list">
          {filtered.map((n) => (
            <Card
              key={n.id}
              className={`notif-card notif-${n.priority}`}
              onClick={() => markRead(n.id)}
            >
              <span className={`notif-icon notif-icon-${n.priority}`}>{categoryIcon(n.category)}</span>
              <div>
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                <small>{n.category.toUpperCase()} · {timeAgo(n.created_at)}</small>
              </div>
              {!n.read && <span className="notif-unread" />}
            </Card>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <Bell size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ margin: 0 }}>No notifications in this category.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LanguageSettingsScreen({ onBack }: { onBack: () => void }) {
  const { language, setLanguage, voiceGender, setVoiceGender, speechSpeed, setSpeechSpeed } = useApp();
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState<'all' | 'global' | 'india' | 'ner'>('all');
  const [hasChanged, setHasChanged] = useState(false);

  const filtered = languages.filter((l) => {
    const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.nativeName.toLowerCase().includes(search.toLowerCase());
    const matchesRegion = region === 'all' || l.region === region;
    return matchesSearch && matchesRegion;
  });

  const grouped: Record<string, LanguageItem[]> = { ner: [], india: [], global: [] };
  filtered.forEach((l) => grouped[l.region].push(l));
  const regionLabels = { ner: 'North Eastern Region Languages', india: 'Indian Languages', global: 'Global Languages' };

  const handleSelectLang = (code: string) => {
    setLanguage(code as LangCode);
    setHasChanged(true);
  };

  return (
    <div className="app-screen">
      <ScreenHeader title="Language & Voice" subtitle="Interface and voice navigation settings" onBack={onBack} />
      <div className="screen-body">
        <Input icon={<Search size={18} />} placeholder="Search languages…" value={search} onChange={setSearch} />
        <div className="lang-region-tabs">
          <button className={region === 'all' ? 'active' : ''} onClick={() => setRegion('all')}>All</button>
          <button className={region === 'ner' ? 'active' : ''} onClick={() => setRegion('ner')}>NER</button>
          <button className={region === 'india' ? 'active' : ''} onClick={() => setRegion('india')}>India</button>
          <button className={region === 'global' ? 'active' : ''} onClick={() => setRegion('global')}>Global</button>
        </div>
        {(['ner', 'india', 'global'] as const).map((r) => {
          if (grouped[r].length === 0) return null;
          return (
            <div key={r} className="lang-group">
              <small className="lang-group-label">{regionLabels[r]}</small>
              <div className="lang-list">
                {grouped[r].map((l) => (
                  <button
                    key={l.code}
                    className={`lang-item ${language === l.code ? 'selected' : ''}`}
                    onClick={() => handleSelectLang(l.code)}
                  >
                    <div>
                      <strong>{l.name}</strong>
                      <small>{l.nativeName}</small>
                    </div>
                    {language === l.code && <Check size={18} />}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <SectionHeader title="Voice Settings" />
        <Card className="voice-settings-card">
          <div className="voice-setting-row">
            <div><strong>Voice Language</strong><small>Same as interface language</small></div>
            <span className="voice-current-lang">{languages.find((l) => l.code === language)?.name || 'English'}</span>
          </div>
          <div className="voice-setting-row">
            <div><strong>Speech Speed</strong><small>Navigation instruction pace</small></div>
            <div className="voice-speed-options">
              {(['slow', 'normal', 'fast'] as const).map((s) => (
                <button key={s} className={speechSpeed === s ? 'active' : ''} onClick={() => { setSpeechSpeed(s); setHasChanged(true); }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="voice-setting-row">
            <div><strong>Voice Gender</strong><small>Assistant voice type</small></div>
            <div className="voice-speed-options">
              {(['female', 'male'] as const).map((g) => (
                <button key={g} className={voiceGender === g ? 'active' : ''} onClick={() => { setVoiceGender(g); setHasChanged(true); }}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="voice-setting-row" style={{ borderBottom: 'none' }}>
            <div><strong>Test Voice</strong><small>Hear a sample navigation instruction</small></div>
            <button
              onClick={() => {
                const rate = getRateForSetting(speechSpeed);
                speak(t('voiceTestInstruction', language), language, rate, voiceGender);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--teal)', padding: '6px 12px', background: 'var(--teal-light)', borderRadius: 8 }}
            >
              <Volume2 size={16} /> Play
            </button>
          </div>
        </Card>
        <Button full size="lg" onClick={onBack} leftIcon={hasChanged ? <Check size={18} /> : undefined}>
          {hasChanged ? 'Settings Saved' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

function ProfileScreen({
  role, onBack, onLanguage,
}: { role: Role; onBack: () => void; onLanguage: () => void }) {
  const { profile, updateProfile, uploadAvatar, logout, language } = useApp();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    address: profile?.address || '',
    emergency_contact: profile?.emergency_contact || '',
    assigned_region: profile?.assigned_region || '',
    department: profile?.department || '',
    bio: profile?.bio || '',
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const isOfficer = role === 'officer';

  const handleSave = async () => {
    setSaving(true);
    await updateProfile(formData);
    setSaving(false);
    setEditing(false);
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAvatar(file);
  };

  const update = (key: string, v: string) => setFormData((d) => ({ ...d, [key]: v }));

  return (
    <div className="app-screen">
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
      <ScreenHeader
        title={t('profileTitle', language)}
        onBack={onBack}
        right={
          <button className="header-icon-btn" onClick={() => setEditing(!editing)}>
            <Settings size={20} />
          </button>
        }
      />
      <div className="screen-body">
        <div className="profile-hero">
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="Profile" className="profile-hero-avatar" />
              : (
                <div className="profile-hero-avatar" style={{ background: isOfficer ? '#e0e7ff' : 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isOfficer ? <ShieldCheck size={32} style={{ color: 'var(--navy)' }} /> : <UserRound size={32} style={{ color: 'var(--teal)' }} />}
                </div>
              )
            }
            <div style={{
              position: 'absolute', bottom: 2, right: 2, width: 22, height: 22,
              background: 'var(--teal)', borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff',
            }}>
              <Camera size={10} style={{ color: '#fff' }} />
            </div>
          </div>
          <div className="profile-hero-info">
            <h2>{profile?.full_name || (isOfficer ? 'Field Officer' : 'Driver')}</h2>
            <p>{isOfficer ? `Field Officer · ${profile?.department || 'Field Operations'}` : `Driver · ${profile?.assigned_region || 'Fleet'}`}</p>
            <StatusDot variant="green" label={isOfficer ? t('onDuty', language) : t('online', language)} />
          </div>
        </div>
        <div className="profile-completion">
          <div className="profile-completion-head">
            <span>Profile Completion</span>
            <strong>{profile?.profile_completion || 60}%</strong>
          </div>
          <div className="profile-completion-bar"><div style={{ width: `${profile?.profile_completion || 60}%` }} /></div>
        </div>
        <Card className="profile-info-card">
          <div className="profile-card-head">
            <h3><CircleUserRound size={18} /> {t('personalInfo', language)}</h3>
            <Button variant="ghost" size="sm" leftIcon={<Settings size={14} />} onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel' : t('editProfile', language)}
            </Button>
          </div>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <Input label="Full Name" icon={<UserRound size={18} />} value={formData.full_name} onChange={(v) => update('full_name', v)} />
              <Input label="Phone" icon={<Phone size={18} />} value={formData.phone} onChange={(v) => update('phone', v)} />
              <Input label="Email" icon={<CircleUserRound size={18} />} value={formData.email} onChange={(v) => update('email', v)} />
              {!isOfficer && <Input label="Address" icon={<MapPin size={18} />} value={formData.address} onChange={(v) => update('address', v)} />}
              {!isOfficer && <Input label="Emergency Contact" icon={<Phone size={18} />} value={formData.emergency_contact} onChange={(v) => update('emergency_contact', v)} />}
              {isOfficer && <Input label="Assigned Region" icon={<MapPin size={18} />} value={formData.assigned_region} onChange={(v) => update('assigned_region', v)} />}
              {isOfficer && <TextArea label="Bio" value={formData.bio} onChange={(v) => update('bio', v)} />}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                <Button loading={saving} onClick={handleSave} leftIcon={<Check size={16} />}>{t('saveChanges', language)}</Button>
              </div>
            </div>
          ) : (
            <div className="profile-fields">
              <div><small>{isOfficer ? 'Employee ID' : 'Driver ID'}</small><strong>{isOfficer ? (profile?.employee_id || 'FO-XXXXX') : 'DRV-' + (profile?.id?.slice(0, 4) || 'XXXX')}</strong></div>
              <div><small>Phone</small><strong>{profile?.phone || '--'}</strong></div>
              <div><small>Email</small><strong>{profile?.email || '--'}</strong></div>
              <div><small>{isOfficer ? 'Assigned Region' : 'Emergency Contact'}</small><strong>{isOfficer ? (profile?.assigned_region || '--') : (profile?.emergency_contact || '--')}</strong></div>
              {isOfficer && <div><small>Department</small><strong>{profile?.department || '--'}</strong></div>}
            </div>
          )}
        </Card>
        <Card className="profile-info-card">
          <div className="profile-card-head">
            <h3><ShieldCheck size={18} /> Documents</h3>
            <Button variant="ghost" size="sm" onClick={() => alert('Document management: Upload and verify your documents here.')}>View all</Button>
          </div>
          <div className="document-item">
            <span className="doc-icon"><FileText size={18} /></span>
            <div><strong>{isOfficer ? 'Field Authorization' : 'Driving License'}</strong><small>Verify via document upload</small></div>
            <Badge label="Active" cls="badge-teal" />
          </div>
          <div className="document-item">
            <span className="doc-icon"><FileText size={18} /></span>
            <div><strong>{isOfficer ? 'Safety Certification' : 'Vehicle Insurance'}</strong><small>Active and up to date</small></div>
            <Badge label="Active" cls="badge-teal" />
          </div>
        </Card>
        {!isOfficer && (
          <Card className="profile-vehicle-card">
            <div className="profile-card-head">
              <h3><Truck size={18} /> Vehicle</h3>
              <Button variant="ghost" size="sm" leftIcon={<Settings size={14} />} onClick={() => alert('Vehicle edit: Update your vehicle details.')}>Edit</Button>
            </div>
            <div className="profile-vehicle-info">
              <div className="profile-vehicle-icon"><Truck size={24} /></div>
              <div>
                <strong>Your Vehicle</strong>
                <small>Update via Vehicle Information screen</small>
              </div>
            </div>
          </Card>
        )}
        <button className="settings-link" onClick={onLanguage}>
          <Languages size={19} />
          <div>
            <strong>Language & Voice Settings</strong>
            <small>{languages.find((l) => l.code === language)?.name || 'English'} · Voice navigation</small>
          </div>
          <ChevronRight size={18} />
        </button>
        <div className="profile-stats-row">
          <div className="profile-stat"><Star size={18} /><strong>{profile?.rating?.toFixed(1) || '5.0'}</strong><small>Rating</small></div>
          <div className="profile-stat"><Truck size={18} /><strong>{isOfficer ? (profile?.report_count || 0) : (profile?.trip_count || 0)}</strong><small>{isOfficer ? 'Reports' : 'Trips'}</small></div>
          <div className="profile-stat"><TrendingUp size={18} /><strong>{profile?.on_time_pct || 100}%</strong><small>On-time</small></div>
        </div>
        <div style={{ marginTop: 8, marginBottom: 24 }}>
          <Button
            variant="danger"
            full
            onClick={() => {
              if (window.confirm('Are you sure you want to logout?')) logout();
            }}
          >
            <ArrowLeft size={16} /> Logout
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============ APP ORCHESTRATOR ============ */

const driverTabs = [
  { id: 'driverHome', label: 'Home', icon: Home },
  { id: 'driverTrips', label: 'Trips', icon: Truck },
  { id: 'driverMap', label: 'Map', icon: MapIcon },
  { id: 'driverAlerts', label: 'Alerts', icon: Bell },
  { id: 'driverProfile', label: 'Profile', icon: UserRound },
];

const officerTabs = [
  { id: 'officerHome', label: 'Home', icon: Home },
  { id: 'officerMap', label: 'Map', icon: MapIcon },
  { id: 'officerReports', label: 'Reports', icon: ClipboardList },
  { id: 'officerAlerts', label: 'Alerts', icon: Bell },
  { id: 'officerProfile', label: 'Profile', icon: UserRound },
];

const citizenTabs = [
  { id: 'citizenHome', label: 'Home', icon: Home },
  { id: 'citizenUpload', label: 'Report', icon: Camera },
  { id: 'citizenSubmissions', label: 'My Reports', icon: ClipboardList },
  { id: 'citizenProfile', label: 'Profile', icon: UserRound },
];

function App() {
  const {
    user, profile, authLoading,
    trips, incidents, location, language, unreadCount,
    nearbyHazards, alertedHazardIds,
  } = useApp();

  const [screen, setScreen] = useState<Screen>('splash');
  const [role, setRole] = useState<Role>('driver');
  const [selectedTrip, setSelectedTrip] = useState<AppTrip | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [selectedHalt, setSelectedHalt] = useState<SafeHalt | null>(null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyStep, setEmergencyStep] = useState<'select' | 'sent'>('select');
  const [reportCode, setReportCode] = useState<string>('');
  const [citizenSubmitCode, setCitizenSubmitCode] = useState('');

  const go = useCallback((s: Screen) => {
    setScreen(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openEmergency = useCallback(() => {
    setEmergencyStep('select');
    setEmergencyOpen(true);
  }, []);

  // Auto-redirect if already logged in (splash → home, skip onboarding if complete)
  useEffect(() => {
    if (authLoading) return;
    if (user && profile && screen === 'splash') {
      setRole(profile.role);
      if (profile.role === 'driver') go('driverHome');
      else if (profile.role === 'officer') go('officerHome');
      else if (profile.role === 'citizen') go('citizenHome');
    }
  }, [user, profile, authLoading, screen, go]);

  // After login, route to correct home (skip onboarding for returning users)
  const handlePostLogin = useCallback((r: Role) => {
    setRole(r);
    if (r === 'citizen') { go('citizenHome'); return; }
    if (r === 'driver') {
      // Skip onboarding if profile already complete
      if (profile && profile.profile_completion >= 80) go('driverHome');
      else go('profileSetup');
      return;
    }
    if (r === 'officer') {
      go('securityLock');
    }
  }, [profile, go]);

  // Logout guard — redirect to roleSelect when session ends and block back navigation
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const protectedScreens: Screen[] = [
        'driverHome', 'driverTrips', 'driverMap', 'driverAlerts', 'driverProfile',
        'tripDetails', 'navigation', 'routeSelection', 'noSafeRoute', 'safeHalt',
        'officerHome', 'officerMap', 'officerReports', 'officerAlerts', 'officerProfile',
        'evidenceUpload', 'incidentReport', 'reportConfirmation', 'languageSettings',
        'profileSetup', 'vehicleInfo', 'locationPermission', 'securityLock',
        'citizenHome', 'citizenUpload', 'citizenSubmissions', 'citizenProfile',
      ];
      if (protectedScreens.includes(screen)) {
        setEmergencyOpen(false);
        setSelectedTrip(null);
        go('roleSelect');
        window.history.replaceState(null, '', window.location.href);
      }
    }
  }, [user, authLoading, screen, go]);

  // Block browser back button when logged out
  useEffect(() => {
    const onPopState = () => {
      if (!user) {
        // Prevent back-navigation to authenticated pages
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [user]);

  const driverTabMap: Record<string, Screen> = {
    driverHome: 'driverHome', driverTrips: 'driverTrips', driverMap: 'driverMap',
    driverAlerts: 'driverAlerts', driverProfile: 'driverProfile',
  };
  const officerTabMap: Record<string, Screen> = {
    officerHome: 'officerHome', officerMap: 'officerMap', officerReports: 'officerReports',
    officerAlerts: 'officerAlerts', officerProfile: 'officerProfile',
  };
  const citizenTabMap: Record<string, Screen> = {
    citizenHome: 'citizenHome', citizenUpload: 'citizenUpload',
    citizenSubmissions: 'citizenSubmissions', citizenProfile: 'citizenProfile',
  };

  const isDriverMain = ['driverHome', 'driverTrips', 'driverMap', 'driverAlerts', 'driverProfile'].includes(screen);
  const isOfficerMain = ['officerHome', 'officerMap', 'officerReports', 'officerAlerts', 'officerProfile'].includes(screen);
  const isCitizenMain = ['citizenHome', 'citizenUpload', 'citizenSubmissions', 'citizenProfile'].includes(screen);
  const hasProximityAlert = nearbyHazards.filter((h) => !alertedHazardIds.has(h.id)).length > 0;

  // Active trip for navigation
  const activeTrip = trips.find((t) =>
    t.driver_id === user?.id &&
    ['accepted', 'going_to_pickup', 'arrived_at_pickup', 'package_loaded', 'in_transit', 'arrived_at_destination'].includes(t.status)
  ) || null;

  // Convert incidents to DisasterMarker format — use real Haversine distances
  const disasterMarkers: DisasterMarker[] = incidents.slice(0, 8).map((inc, i) => ({
    id: inc.id,
    type: inc.type as IncidentType,
    label: inc.type,
    detail: inc.location_name || '',
    severity: inc.severity,
    timeReported: timeAgo(inc.created_at),
    distance: (location.lat && location.lng && inc.lat && inc.lng)
      ? `${haversineDistance(location.lat, location.lng, inc.lat, inc.lng).toFixed(1)} km away`
      : '-- km',
    action: inc.description || 'Exercise caution',
    top: `${20 + i * 15}%`,
    left: `${20 + i * 20}%`,
    lat: inc.lat ?? undefined,
    lng: inc.lng ?? undefined,
    variant: inc.severity === 'high' ? 'danger' : inc.severity === 'medium' ? 'warning' : 'advisory',
  }));

  if (authLoading) return <div className="phone-frame"><div className="phone-screen"><LoadingScreen message="Starting up…" /></div></div>;

  return (
    <div className="phone-frame">
      <div className="phone-screen">
        {/* Proximity alert banner for drivers */}
        {hasProximityAlert && isDriverMain && <ProximityAlertBanner onEmergency={openEmergency} />}

        {screen === 'splash' && (
          <SplashScreen onDone={() => {
            if (user && profile) {
              if (profile.role === 'driver') go('driverHome');
              else if (profile.role === 'officer') go('officerHome');
              else go('citizenHome');
            } else go('roleSelect');
          }} />
        )}
        {screen === 'roleSelect' && (
          <RoleSelectScreen onSelect={(r) => {
            setRole(r);
            if (r === 'driver') go('driverLogin');
            else if (r === 'officer') go('officerLogin');
            else go('citizenLogin');
          }} />
        )}
        {screen === 'driverLogin' && (
          <LoginScreen role="driver" onLogin={() => handlePostLogin('driver')} onBack={() => go('roleSelect')} onSignup={() => go('driverSignup')} />
        )}
        {screen === 'driverSignup' && (
          <SignupScreen role="driver" onSignup={() => go('driverLogin')} onBack={() => go('driverLogin')} />
        )}
        {screen === 'officerLogin' && (
          <LoginScreen role="officer" onLogin={() => handlePostLogin('officer')} onBack={() => go('roleSelect')} onSignup={() => go('officerSignup')} />
        )}
        {screen === 'officerSignup' && (
          <SignupScreen role="officer" onSignup={() => go('officerLogin')} onBack={() => go('officerLogin')} />
        )}
        {screen === 'citizenLogin' && (
          <LoginScreen role="citizen" onLogin={() => handlePostLogin('citizen')} onBack={() => go('roleSelect')} onSignup={() => go('citizenSignup')} />
        )}
        {screen === 'citizenSignup' && (
          <SignupScreen role="citizen" onSignup={() => go('citizenLogin')} onBack={() => go('citizenLogin')} />
        )}
        {screen === 'securityLock' && (
          <SecurityLockScreen onUnlock={() => {
            if (profile && profile.profile_completion >= 80) go('officerHome');
            else go('profileSetup');
          }} onBack={() => go('officerLogin')} />
        )}
        {screen === 'profileSetup' && (
          <ProfileSetupScreen
            role={role}
            onDone={() => go(role === 'driver' ? 'vehicleInfo' : 'locationPermission')}
            onBack={() => go(role === 'driver' ? 'driverLogin' : 'securityLock')}
          />
        )}
        {screen === 'vehicleInfo' && (
          <VehicleInfoScreen onContinue={() => go('locationPermission')} onBack={() => go('profileSetup')} />
        )}
        {screen === 'locationPermission' && (
          <LocationPermissionScreen
            onAllow={() => go(role === 'driver' ? 'driverHome' : 'officerHome')}
            onBack={() => go('profileSetup')}
          />
        )}

        {/* Driver Screens */}
        {screen === 'driverHome' && (
          <DriverHome
            onNavigate={go}
            onEmergency={openEmergency}
            onViewTrip={(t) => { setSelectedTrip(t); go('tripDetails'); }}
          />
        )}
        {screen === 'driverTrips' && (
          <DriverTripsScreen
            onViewTrip={(t) => { setSelectedTrip(t); go('tripDetails'); }}
            onBack={() => go('driverHome')}
          />
        )}
        {screen === 'driverMap' && (
          <div className="app-screen">
            <ScreenHeader
              title="Disaster Map"
              subtitle="Hazard markers and route conditions"
              onBack={() => go('driverHome')}
            />
            <div className="full-map-wrap">
              <MapCanvas
                markers={disasterMarkers}
                height="100%"
                userLat={location.lat}
                userLng={location.lng}
                userAccuracy={location.accuracy}
                pickupLat={activeTrip?.pickup_lat}
                pickupLng={activeTrip?.pickup_lng}
                destLat={activeTrip?.drop_lat}
                destLng={activeTrip?.drop_lng}
                routes={selectedRoute ? [selectedRoute] : undefined}
                selectedRouteIndex={0}
              />
            </div>
          </div>
        )}
        {screen === 'driverAlerts' && <AlertsScreen onBack={() => go('driverHome')} role="driver" />}
        {screen === 'driverProfile' && (
          <ProfileScreen role="driver" onBack={() => go('driverHome')} onLanguage={() => go('languageSettings')} />
        )}
        {screen === 'tripDetails' && selectedTrip && (
          <TripDetailsScreen
            trip={selectedTrip}
            onAccept={() => {
              // Go to route selection after accepting
              go('routeSelection');
            }}
            onBack={() => go('driverTrips')}
          />
        )}
        {screen === 'routeSelection' && (activeTrip || selectedTrip) && (
          <RouteSelectionScreen
            trip={(activeTrip || selectedTrip)!}
            onSelectRoute={(route) => { setSelectedRoute(route); go('navigation'); }}
            onNoSafeRoute={() => go('noSafeRoute')}
            onBack={() => go('tripDetails')}
          />
        )}
        {screen === 'noSafeRoute' && (
          <NoSafeRouteScreen
            trip={activeTrip || selectedTrip}
            onSelectHalt={(halt) => { setSelectedHalt(halt); go('navigation'); }}
            onBack={() => go('routeSelection')}
          />
        )}
        {screen === 'navigation' && (
          <NavigationScreen
            onBack={() => go('driverHome')}
            onEmergency={openEmergency}
            onFinishTrip={() => {
              const currentId = activeTrip?.id || selectedTrip?.id;
              if (currentId) {
                finishTrip(currentId);
              }
              go('driverHome');
            }}
            trip={activeTrip || selectedTrip}
            selectedRoute={selectedRoute}
          />
        )}

        {/* Officer Screens */}
        {screen === 'officerHome' && <OfficerHome onNavigate={go} onEmergency={openEmergency} />}
        {screen === 'officerMap' && (
          <div className="app-screen">
            <ScreenHeader
              title="Operations Map"
              subtitle="Incidents, drivers and field operations"
              onBack={() => go('officerHome')}
            />
            <div className="full-map-wrap">
              <MapCanvas
                markers={disasterMarkers}
                height="100%"
                userLat={location.lat}
                userLng={location.lng}
              />
            </div>
          </div>
        )}
        {screen === 'officerReports' && (
          <div className="app-screen">
            <ScreenHeader title="Field Reports" onBack={() => go('officerHome')} />
            <div className="screen-body">
              <div className="report-actions">
                <Card className="report-action-card" onClick={() => go('incidentReport')}>
                  <FileText size={22} /><strong>Create Incident Report</strong><small>Document a new situation</small><ArrowRight size={18} />
                </Card>
                <Card className="report-action-card" onClick={() => go('evidenceUpload')}>
                  <Upload size={22} /><strong>Upload Evidence</strong><small>Attach photos or video</small><ArrowRight size={18} />
                </Card>
              </div>
              <SectionHeader title="Recent Reports" />
              <div className="report-list">
                {incidents.slice(0, 10).map((r) => (
                  <Card key={r.id} className="report-row-card">
                    <span className="report-row-icon"><FileText size={18} /></span>
                    <div>
                      <strong>{r.type}</strong>
                      <small>{r.incident_code} · {timeAgo(r.created_at)}</small>
                    </div>
                    <Badge
                      label={r.status.replace(/_/g, ' ')}
                      cls={r.status === 'verified' ? 'badge-teal' : r.status === 'response_active' ? 'badge-orange' : 'badge-amber'}
                    />
                  </Card>
                ))}
                {incidents.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                    <FileText size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <p style={{ margin: 0, fontSize: 13 }}>No reports yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {screen === 'officerAlerts' && <AlertsScreen onBack={() => go('officerHome')} role="officer" />}
        {screen === 'officerProfile' && (
          <ProfileScreen role="officer" onBack={() => go('officerHome')} onLanguage={() => go('languageSettings')} />
        )}
        {screen === 'evidenceUpload' && (
          <EvidenceUploadScreen onSubmit={() => go('reportConfirmation')} onBack={() => go('officerReports')} />
        )}
        {screen === 'incidentReport' && (
          <IncidentReportScreen
            onSubmit={(code) => { setReportCode(code); go('reportConfirmation'); }}
            onBack={() => go('officerReports')}
          />
        )}
        {screen === 'reportConfirmation' && (
          <ReportConfirmationScreen
            onDone={() => go('officerHome')}
            onView={() => go('officerReports')}
            onBack={() => go('incidentReport')}
            reportCode={reportCode}
          />
        )}
        {screen === 'languageSettings' && (
          <LanguageSettingsScreen onBack={() => {
            if (role === 'driver') go('driverProfile');
            else if (role === 'officer') go('officerProfile');
            else go('citizenProfile');
          }} />
        )}

        {/* Citizen Screens */}
        {screen === 'citizenHome' && (
          <CitizenHome onNavigate={go} onEmergency={openEmergency} />
        )}
        {screen === 'citizenUpload' && (
          <CitizenUploadScreen
            onSubmit={(code) => { setCitizenSubmitCode(code); go('reportConfirmation'); }}
            onBack={() => go('citizenHome')}
          />
        )}
        {screen === 'citizenSubmissions' && (
          <CitizenSubmissionsScreen onBack={() => go('citizenHome')} />
        )}
        {screen === 'citizenProfile' && (
          <CitizenProfileScreen onBack={() => go('citizenHome')} />
        )}

        {/* Bottom Nav */}
        {isDriverMain && (
          <BottomNav
            tabs={driverTabs}
            active={screen}
            onChange={(id) => go(driverTabMap[id])}
            alertCount={unreadCount}
          />
        )}
        {isOfficerMain && (
          <BottomNav
            tabs={officerTabs}
            active={screen}
            onChange={(id) => go(officerTabMap[id])}
            alertCount={unreadCount}
          />
        )}
        {isCitizenMain && (
          <BottomNav
            tabs={citizenTabs}
            active={screen}
            onChange={(id) => go(citizenTabMap[id])}
            alertCount={unreadCount}
          />
        )}

        {/* Emergency FAB for map and citizen screens */}
        {(screen === 'driverMap' || screen === 'officerMap') && (
          <button className="emergency-fab" onClick={openEmergency}>
            <Siren size={18} /><span>Emergency</span>
          </button>
        )}

        {/* Emergency Modal */}
        {emergencyOpen && (
          <EmergencyModal
            step={emergencyStep}
            setStep={setEmergencyStep}
            onClose={() => setEmergencyOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
