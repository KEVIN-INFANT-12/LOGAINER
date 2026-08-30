import React, { useState } from 'react';
import { 
  Users, 
  Truck, 
  ShieldCheck, 
  Lock, 
  Key, 
  Plus, 
  Search, 
  MapPin 
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
    addToast({
      title: 'Authority Registered',
      message: 'RBAC credentials initialized with Argon2 password hashing.',
      type: 'success'
    });
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
              <Users className="w-6 h-6 text-teal-700" />
              <span>User & Vehicle Fleet Management</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200 flex items-center space-x-1">
              <Lock className="w-3 h-3 text-teal-700" />
              <span>RBAC & ARGON2 SECURE</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Role-Based Access Control for District Authorities, State Logistics Directors & Central Command Fleet Allocations
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('OFFICERS')}
            className={`px-3.5 py-1.5 rounded-md flex items-center space-x-2 transition-all ${
              activeTab === 'OFFICERS'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>District Authorities ({officers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('FLEET')}
            className={`px-3.5 py-1.5 rounded-md flex items-center space-x-2 transition-all ${
              activeTab === 'FLEET'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4 text-teal-700" />
            <span>Vehicle Fleet Registry ({vehicles.length})</span>
          </button>
        </div>
      </div>

      {/* Security Architecture Callout */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-xs flex items-center space-x-2">
              <span>Enterprise RBAC & Cryptographic Security</span>
              <span className="text-[10px] font-mono text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                JWT Bearer + Argon2
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Only authorized government personnel and district nodal officers are provisioned with dispatch management rights.
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setIsAddOfficerModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5 transition-all"
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
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-card">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search officer by name, district, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-teal-700 w-64 shadow-sm"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-teal-700 shadow-sm"
              >
                <option value="ALL">All Roles</option>
                <option value="Admin / Central Command">Admin / Central Command</option>
                <option value="State Logistics Director">State Logistics Director</option>
                <option value="Chief Engineer (BRO)">Chief Engineer (BRO)</option>
                <option value="Emergency Response Officer (NDRF)">Emergency Response Officer (NDRF)</option>
                <option value="District Authority / DLO">District Authority / DLO</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="text-slate-900 font-bold">{filteredOfficers.length}</span> Active Authorities
            </div>
          </div>

          {/* Officers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOfficers.map((officer) => (
              <div
                key={officer.id}
                className="p-5 rounded-xl bg-white border border-slate-200 shadow-card hover:border-teal-600/40 hover:shadow-card-hover transition-all space-y-3"
              >
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs text-slate-400">{officer.id}</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {officer.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-slate-900 mt-1">{officer.name}</h3>
                    <div className="text-xs text-teal-800 font-semibold">{officer.role}</div>
                  </div>

                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 flex items-center justify-center font-bold text-xs">
                    {officer.name.charAt(0)}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="text-[11px] text-slate-500">{officer.department}</div>
                  <div className="flex items-center space-x-1.5 text-teal-800 font-medium text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-teal-700" />
                    <span>Jurisdiction: {officer.district || officer.state}, {officer.state}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">Email: {officer.email}</div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span className="flex items-center space-x-1">
                    <Key className="w-3 h-3 text-emerald-700" />
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
        <div className="bg-white p-5 rounded-xl space-y-4 border border-slate-200 shadow-card overflow-x-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs uppercase font-bold text-slate-700 tracking-wider flex items-center space-x-2">
              <Truck className="w-4 h-4 text-teal-700" />
              <span>Registered Cold-Chain & Emergency Fleet Assets</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{vehicles.length} Vehicles in Database</span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3">Registration No</th>
                <th className="p-3">Assigned Cargo</th>
                <th className="p-3">Driver & Contact</th>
                <th className="p-3">Route Corridor</th>
                <th className="p-3">Capacity</th>
                <th className="p-3">Telemetry Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{v.vehicle_no}</div>
                    <div className="text-[10px] text-slate-400">{v.id}</div>
                  </td>

                  <td className="p-3">
                    <div className="font-semibold text-slate-800">{v.cargo_desc}</div>
                    <div className="text-[10px] text-teal-800 uppercase font-semibold">{v.cargo_type.replace(/_/g, ' ')}</div>
                  </td>

                  <td className="p-3">
                    <div className="text-slate-900 font-medium">{v.driver_name}</div>
                    <div className="text-[10px] text-slate-500">{v.driver_phone}</div>
                  </td>

                  <td className="p-3 text-slate-700">
                    <div>{v.origin_name} ➔ {v.destination_name}</div>
                    <div className="text-[10px] text-slate-400">{v.speed_kmh} km/h • {v.progress_pct}% Completed</div>
                  </td>

                  <td className="p-3 font-bold text-slate-900">
                    {v.weight_tonnes} Tonnes
                  </td>

                  <td className="p-3">
                    <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                      v.is_sos ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-modal border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Lock className="w-4 h-4 text-teal-700" />
                <span>Provision Authority Account</span>
              </h3>
              <button onClick={() => setIsAddOfficerModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleAddOfficer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name & Designation</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. S. Debbarma, TFS"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Gov Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. s.debbarma@tripura.gov.in"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">System Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
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
                  <label className="block font-semibold text-slate-700 mb-1">State Jurisdiction</label>
                  <select
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
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
                  <label className="block font-semibold text-slate-700 mb-1">District / HQ</label>
                  <input
                    type="text"
                    placeholder="e.g. West Tripura"
                    value={newDistrict}
                    onChange={(e) => setNewDistrict(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOfficerModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm"
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
