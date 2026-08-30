import React, { useState, useRef } from 'react';
import { 
  X, 
  MapPin, 
  Camera, 
  Video,
  AlertTriangle, 
  CheckCircle, 
  Upload, 
  WifiOff, 
  Radio,
  FileText,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';
import { useAuth } from '../context/AuthContext';
import { Incident } from '../types';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IncidentReportModal: React.FC<IncidentReportModalProps> = ({ isOpen, onClose }) => {
  const { reportNewIncident, isOnline } = useLogistics();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Incident['category']>('LANDSLIDE');
  const [severity, setSeverity] = useState<Incident['severity']>('HIGH');
  const [state, setState] = useState('Meghalaya');
  const [district, setDistrict] = useState('East Khasi Hills');
  const [lat, setLat] = useState(25.5788);
  const [lng, setLng] = useState(91.8933);
  const [description, setDescription] = useState('');
  const [passableBy, setPassableBy] = useState<Incident['passable_by']>('NONE');
  const [photoUrl, setPhotoUrl] = useState<string>('https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80');
  const [isLocating, setIsLocating] = useState(false);

  // Real Binary Media Attachments (Photos / Videos)
  const [mediaFiles, setMediaFiles] = useState<Array<{ file: File; name: string; type: 'PHOTO' | 'VIDEO'; previewUrl: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleGetCurrentLocation = () => {
    if ('geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(parseFloat(pos.coords.latitude.toFixed(5)));
          setLng(parseFloat(pos.coords.longitude.toFixed(5)));
          setIsLocating(false);
        },
        () => {
          setIsLocating(false);
        }
      );
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const preview = URL.createObjectURL(file);
      setMediaFiles(prev => [...prev, { file, name: file.name, type: 'PHOTO', previewUrl: preview }]);
      setPhotoUrl(preview);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const preview = URL.createObjectURL(file);
      setMediaFiles(prev => [...prev, { file, name: file.name, type: 'VIDEO', previewUrl: preview }]);
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const attachments = mediaFiles.map(m => ({
      file: m.file,
      name: m.name,
      type: m.type
    }));

    await reportNewIncident(
      {
        title,
        category,
        severity,
        state,
        district,
        lat,
        lng,
        description,
        reporter_name: user?.full_name || 'Ground Official',
        reporter_role: user?.role || 'Field Official',
        passable_by: passableBy,
        photo_url: photoUrl
      },
      attachments
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-xl rounded-2xl glass-panel-glow p-6 shadow-2xl border border-cyan-500/30 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Upload Field Incident / Obstruction Report</h3>
              <p className="text-xs text-slate-400">
                Geo-tagged report for road blockages, landslides, floods & bridge damages across NER
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Offline Badge */}
        {!isOnline && (
          <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs flex items-center space-x-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Zero Connectivity Zone: Incident + Media Blobs will be stored in IndexedDB (PENDING_UPLOAD) and auto-sync when online.</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Incident Headline / Corridor Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Sonapur Tunnel Mudflow & Debris Overflow"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Obstruction Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="LANDSLIDE">Massive Landslide</option>
                <option value="FLASH_FLOOD">Flash Flood / River Swelling</option>
                <option value="MUDSLIDE">Mudslide & Slurry</option>
                <option value="ROCKFALL">Boulder Rockfall</option>
                <option value="BRIDGE_WASHOUT">Bridge Damage / Washout</option>
                <option value="SNOW_BLOCK">High Altitude Snow Blockage</option>
                <option value="TREE_FALL">Fallen Trees / Power Lines</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Severity & Road Impact</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="CRITICAL_BLOCKED">Critical - Both Lanes Blocked (Total Stop)</option>
                <option value="HIGH">High - Single Lane Slippery / Crawling</option>
                <option value="MEDIUM">Medium - Advisory / 4x4 Bypass Active</option>
                <option value="LOW">Low - Shoulder Obstruction Only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="Assam">Assam</option>
                <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                <option value="Meghalaya">Meghalaya</option>
                <option value="Manipur">Manipur</option>
                <option value="Mizoram">Mizoram</option>
                <option value="Nagaland">Nagaland</option>
                <option value="Tripura">Tripura</option>
                <option value="Sikkim">Sikkim</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">District / Hill Area</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* GPS Coordinates */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>Geo-Tagged Location Coordinates</span>
              </span>
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={isLocating}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-mono text-[10px] border border-cyan-500/30"
              >
                {isLocating ? 'Acquiring GPS...' : '📍 Auto-Detect GPS'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div>
                <label className="text-[10px] text-slate-400">Latitude</label>
                <input
                  type="number"
                  step="0.00001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-white text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Longitude</label>
                <input
                  type="number"
                  step="0.00001"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-white text-xs"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Field Description & Clearance Assessment</label>
            <textarea
              rows={3}
              required
              placeholder="Provide exact km mark, estimated debris volume, stranded vehicle count, and nearest safe turn-around point..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Passable by */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Immediate Passability Status</label>
            <select
              value={passableBy}
              onChange={(e) => setPassableBy(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="NONE">Completely Impassable (All Traffic Stopped)</option>
              <option value="4X4_ONLY">4x4 / Heavy Off-Road Trucks Only</option>
              <option value="LIGHT_VEHICLES_ONLY">Light Passenger Vehicles Only</option>
              <option value="ALL_VEHICLES">Open with Caution / Reduced Speed</option>
            </select>
          </div>

          {/* Photo & Video Binary Attachments (IndexedDB Blob Storage) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-semibold text-slate-300">Evidence Media (Stored as Blobs in IndexedDB)</label>
              <div className="flex items-center space-x-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handlePhotoSelect} 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-[11px] font-semibold border border-cyan-500/30 flex items-center space-x-1 hover:bg-cyan-500/30"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Attach Photo</span>
                </button>

                <input 
                  type="file" 
                  ref={videoInputRef} 
                  accept="video/*" 
                  className="hidden" 
                  onChange={handleVideoSelect} 
                />
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-[11px] font-semibold border border-purple-500/30 flex items-center space-x-1 hover:bg-purple-500/30"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Attach Video</span>
                </button>
              </div>
            </div>

            {/* Attached media preview pills */}
            {mediaFiles.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-slate-900/60 border border-white/10">
                {mediaFiles.map((m, idx) => (
                  <div key={idx} className="relative flex items-center space-x-2 p-2 rounded-lg bg-slate-950 border border-white/10 group">
                    {m.type === 'PHOTO' ? (
                      <img src={m.previewUrl} alt={m.name} className="w-12 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-10 rounded bg-purple-900/50 flex items-center justify-center text-purple-300">
                        <Video className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-[10px]">
                      <div className="font-bold text-white truncate">{m.name}</div>
                      <div className="text-slate-400 font-mono">{(m.file.size / 1024).toFixed(1)} KB ({m.type})</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMedia(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-900/60 border border-white/10">
                <img src={photoUrl} alt="Default Snapshot" className="w-16 h-12 object-cover rounded-lg border border-white/10" />
                <div className="text-[11px] text-slate-400">
                  <div>Default terrain reference attached. Add live photos or video clips above.</div>
                  <div className="text-[10px] text-cyan-400 font-mono">IndexedDB Blob Engine: Active</div>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-glow-cyan flex items-center space-x-1.5 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>{isOnline ? 'Broadcast Incident Alert' : 'Save Offline Report (IndexedDB)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
