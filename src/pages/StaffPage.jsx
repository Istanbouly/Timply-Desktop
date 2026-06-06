export default function StaffPage({ staff, profile, ownerUserId }) {
  function getInitials(name = '') {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  const AVATAR_COLORS = ['bg-violet-500','bg-sky-500','bg-teal-500','bg-rose-500','bg-amber-500','bg-indigo-500'];
  function avatarColor(name = '') {
    let s = 0; for (const c of name) s += c.charCodeAt(0);
    return AVATAR_COLORS[s % AVATAR_COLORS.length];
  }

  const members = [
    ...(profile ? [{ id: ownerUserId, name: profile.name, avatar_url: profile.avatar_url, status: 'active', role: 'Owner' }] : []),
    ...(staff || []).map(s => ({ ...s, role: 'Staff' })),
  ];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-stone-800">Staff</h1>
          <p className="text-xs text-stone-400 mt-1">{members.length} team member{members.length !== 1 ? 's' : ''} at your business.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {members.map(m => (
            <div key={m.id} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-4">
              {/* Avatar */}
              {m.avatar_url
                ? <img src={m.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                : <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${avatarColor(m.name)}`}>
                    <span className="text-xs font-bold text-white">{getInitials(m.name)}</span>
                  </div>
              }
              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-stone-800 truncate">{m.name}</p>
                <p className="text-xs text-stone-400">{m.role}</p>
              </div>
              {/* Status */}
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                m.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-400'
              }`}>
                {m.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
