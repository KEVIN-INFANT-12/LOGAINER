import React, { useState } from 'react';
import { 
  Users, 
  Truck, 
  ShieldCheck, 
  Lock, 
  Key, 
  Plus, 
  Edit3, 
  CheckCircle, 
  Search, 
  Filter, 
  Building2, 
  Phone, 
  MapPin, 
  Gauge,
  Radio,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLogistics } from '../context/LogisticsContext';
import { Role, FleetVehicle } from '../types';

interface OfficerAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  state: string;
  district?: string;
  status: 'ACTIVE' | 'ON_DUTY' | 'STANDBY';
  authType: 'JWT + Argon2' | 'JWT + bcrypt';
  lastActive: string;
}

export const UserVehicleManagement: React.FC = () => {
  const { user } = useAuth();
  const { vehicles, addToast } = useLogistics();

  const [activeTab, setActiveTab] = useState<'OFFICERS' | 'FLEET'>('OFFICERS');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Registered Admin & District Authority Accounts
  const [officers, setOfficers] = useState<OfficerAccount[]>([
    {
      id: 'USR-101',
      name: 'Dr. Anupam Sarma, IAS',
      email: 'officer@logainer.gov.in',
      role: 'State Logistics Director',
      department: 'Ministry of Development of North Eastern Region (MDoNER)',
      state: 'Assam',
      district: 'Kamrup Metro (Guwahati)',
      status: 'ACTIVE',
      authType: 'JWT + Argon2',
      lastActive: 'Active now'
    },
    {
      id: 'USR-102',
      name: 'Col. R. K. Thapa',
      email: 'bro.commander@gov.in',
      role: 'Chief Engineer (BRO)',
      department: 'Border Roads Organisation (Project Vartak)',
      state: 'Arunachal Pradesh',
      district: 'West Kameng',
      status: 'ON_DUTY',
      authType: 'JWT + Argon2',
      lastActive: '14 mins ago'
    },
    {
      id: 'USR-103',
      name: 'Commander J. Sangma',
      email: 'ndrf.commander@gov.in',
      role: 'Emergency Response Officer (NDRF)',
      department: 'National Disaster Response Force (1st Bn NDRF)',
      state: 'Meghalaya',
      district: 'East Khasi Hills (Shillong)',
      status: 'ON_DUTY',
      authType: 'JWT + bcrypt',
      lastActive: '2 mins ago'
    },
    {
      id: 'USR-104',
      name: 'EAC P. Jamir, ACS',
      email: 'dlo.kohima@gov.in',
      role: 'District Authority / DLO',
      department: 'District Administration & Logistics Cell',
      state: 'Nagaland',
      district: 'Kohima District',
      status: 'ACTIVE',
      authType: 'JWT + Argon2',
      lastActive: '45 mins ago'
    },
    {
      id: 'USR-105',
      name: 'Dr. Himanta K. Das',
      email: 'admin@logainer.gov.in',
      role: 'Admin / Central Command',
      department: 'NER Logistics Operations Command Center',
      state: 'Assam (HQ)',
      district: 'Regional Command',
      status: 'ACTIVE',
      authType: 'JWT + Argon2',
      lastActive: 'Active now'
    }
  ]);

  // Registered Vehicle Registry State
  const [fleetRegistry, setFleetRegistry] = useState<FleetVehicle[]>(vehicles);

  // New Officer modal state
  const [isAddOfficerModalOpen, setIsAddOfficerModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('District Authority / DLO');
  const [newState, setNewState] = useState('Assam');
  const [newDistrict, setNewDistrict] = useState('');

  const handleAddOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    const newAcc: OfficerAccount = {
      id: `USR-${Math.floor(100 + Math.random() * 900)}`,
      name: newName,
      email: newEmail,
      role: newRole,
      department: newRole.includes('BRO') ? 'Border Roads Organisation' : newRole.includes('NDRF') ? 'National Disaster Response Force' : 'District Administration',
      state: newState,
      district: newDistrict || `${newState} Command`,
      status: 'ACTIVE',
      authType: 'JWT + Argon2',
      lastActive: 'Just registered'
    };

    setOfficers([newAcc, ...officers]);
    setIsAddOfficerModalOpen(false);
    setNewName('');
    setNewEmail('');
    setNewDistrict('');
    addToast('SUCCESS', 'Authority Registered', `RBAC credentials initialized with Argon2 password hashing.`);
  };

  const filteredOfficers = officers.filter(o => {
    const matchesRole = roleFilter === 'ALL' || o.role === roleFilter;
    const matchesSearch = 
      o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.district && o.district.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
              <Users className="w-6 h-6 text-cyan-400" />
              <span>User & Vehicle Fleet Management</span>
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center space-x-1">
              <Lock className="w-3 h-3 text-cyan-400" />
              <span>RBAC & ARGON2 SECURE</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Role-Based Access Control for District Authorities, State Logistics Directors & Central Command Fleet Allocations
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-white/10 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('OFFICERS')}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
              activeTab === 'OFFICERS'
                ? 'bg-cyan-500 text-slate-950 shadow-glow-cyan font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>District Authorities ({officers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('FLEET')}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
              activeTab === 'FLEET'
                ? 'bg-cyan-500 text-slate-950 shadow-glow-cyan font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Vehicle Fleet Registry ({vehicles.length})</span>
          </button>
        </div>
      </div>

      {/* Security Architecture Callout (JWT + Argon2) */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-xs flex items-center space-x-2">
              <span>Enterprise RBAC & Cryptographic Security</span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                JWT Bearer + Argon2 / bcrypt
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Only authorized government personnel and district nodal officers are provisioned with dispatch management rights.
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setIsAddOfficerModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-glow-cyan flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Provision New Officer</span>
          </button>
        </div>
      </div>

      {/* View 1: District Authorities & Officers */}
      {activeTab === 'OFFICERS' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl glass-panel border border-white/10">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search officer by name, district, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500 w-64"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Roles</option>
                <option value="Admin / Central Command">Admin / Central Command</option>
                <option value="State Logistics Director">State Logistics Director</option>
                <option value="Chief Engineer (BRO)">Chief Engineer (BRO)</option>
                <option value="Emergency Response Officer (NDRF)">Emergency Response Officer (NDRF)</option>
                <option value="District Authority / DLO">District Authority / DLO</option>
              </select>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Showing <span className="text-cyan-400 font-bold">{filteredOfficers.length}</span> Active Authorities
            </div>
          </div>

          {/* Officers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOfficers.map((officer) => (
              <div
                key={officer.id}
                className="p-5 rounded-2xl glass-panel border border-white/10 hover:border-cyan-500/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between pb-3 border-b border-white/10">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs text-slate-400">{officer.id}</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300">
                        {officer.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-white mt-1">{officer.name}</h3>
                    <div className="text-xs text-cyan-400 font-semibold">{officer.role}</div>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center justify-center font-bold text-xs">
                    {officer.name.charAt(0)}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="text-[11px] text-slate-400">{officer.department}</div>
                  <div className="flex items-center space-x-1.5 text-cyan-300 font-mono text-[11px]">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Jurisdiction: {officer.district || officer.state}, {officer.state}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">Email: {officer.email}</div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="flex items-center space-x-1">
                    <Key className="w-3 h-3 text-emerald-400" />
                    <span>{officer.authType}</span>
                  </span>
                  <span>{officer.lastActive}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View 2: Vehicle Fleet Registry */}
      {activeTab === 'FLEET' && (
        <div className="glass-panel p-5 rounded-2xl space-y-4 border border-white/10 overflow-x-auto">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-xs uppercase font-bold text-cyan-400 tracking-wider flex items-center space-x-2">
              <Truck className="w-4 h-4" />
              <span>Registered Cold-Chain & Emergency Fleet Assets</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">{vehicles.length} Vehicles in Database</span>
          </div>

          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[11px] uppercase font-mono text-slate-400 border-b border-white/10">
              <tr>
                <th className="p-3">Registration No</th>
                <th className="p-3">Assigned Cargo</th>
                <th className="p-3">Driver & Contact</th>
                <th className="p-3">Route Corridor</th>
                <th className="p-3">Capacity</th>
                <th className="p-3">Telemetry Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-3">
                    <div className="font-bold text-white">{v.vehicle_no}</div>
                    <div className="text-[10px] text-slate-400">{v.id}</div>
                  </td>

                  <td className="p-3">
                    <div className="font-semibold text-slate-200">{v.cargo_desc}</div>
                    <div className="text-[10px] text-cyan-300 uppercase">{v.cargo_type.replace(/_/g, ' ')}</div>
                  </td>

                  <td className="p-3">
                    <div className="text-white">{v.driver_name}</div>
                    <div className="text-[10px] text-slate-400">{v.driver_phone}</div>
                  </td>

                  <td className="p-3">
                    <div>{v.origin_name} ➔ {v.destination_name}</div>
                    <div className="text-[10px] text-slate-400">{v.speed_kmh} km/h • {v.progress_pct}% Completed</div>
                  </td>

                  <td className="p-3 font-bold text-white">
                    {v.weight_tonnes} Tonnes
                  </td>

                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      v.is_sos ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Provision Officer Modal */}
      {isAddOfficerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl glass-panel-glow p-6 shadow-2xl border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Provision Authority Account</span>
              </h3>
              <button onClick={() => setIsAddOfficerModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddOfficer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Full Name & Designation</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. S. Debbarma, TFS"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Official Gov Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. s.debbarma@tripura.gov.in"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">System Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="District Authority / DLO">District Authority / DLO</option>
                  <option value="Chief Engineer (BRO)">Chief Engineer (BRO)</option>
                  <option value="Emergency Response Officer (NDRF)">Emergency Response Officer (NDRF)</option>
                  <option value="State Logistics Director">State Logistics Director</option>
                  <option value="Admin / Central Command">Admin / Central Command</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">State Jurisdiction</label>
                  <select
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
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
                  <label className="block font-semibold text-slate-300 mb-1">District / HQ</label>
                  <input
                    type="text"
                    placeholder="e.g. West Tripura"
                    value={newDistrict}
                    onChange={(e) => setNewDistrict(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddOfficerModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-glow-cyan"
                >
                  Create RBAC Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
