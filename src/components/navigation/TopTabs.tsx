export type AppTab = 'create' | 'featured' | 'home' | 'search' | 'friends'

interface TabItem {
  id: AppTab
  label: string
}

const TABS: TabItem[] = [
  { id: 'create', label: 'Create' },
  { id: 'featured', label: 'Featured' },
  { id: 'home', label: 'Home' },
  { id: 'search', label: 'Search' },
  { id: 'friends', label: 'Friends' },
]

interface Props {
  activeTab: AppTab
  onChange: (tab: AppTab) => void
}

export default function TopTabs({ activeTab, onChange }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2">
        {TABS.map((tab) => {
          const selected = tab.id === activeTab

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={[
                'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                selected
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:bg-white/80 hover:text-gray-800',
              ].join(' ')}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
