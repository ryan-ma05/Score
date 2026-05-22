import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/create', label: 'Create' },
  { to: '/featured', label: 'Featured' },
  { to: '/home', label: 'Home' },
  { to: '/search', label: 'Search' },
  { to: '/friends', label: 'Friends' },
  { to: '/profile', label: 'Profile' },
]

export default function TopTabs() {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              [
                'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:bg-white/80 hover:text-gray-800',
              ].join(' ')
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
