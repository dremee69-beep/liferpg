// THE TAB BAR at the bottom of the screen: one tap to switch screens.

// The screens the app has. Add a line here when a new screen is built.
export const SCREENS = [
  { id: 'village', name: 'Village' },
  { id: 'quests', name: 'Quests' },
  { id: 'camp', name: 'Camp' },
] as const

// A ScreenId is one of: 'village' | 'quests' | 'camp'
export type ScreenId = (typeof SCREENS)[number]['id']

type Props = {
  current: ScreenId
  onChange: (screen: ScreenId) => void
}

export function TabBar({ current, onChange }: Props) {
  return (
    <nav className="tabbar" aria-label="Screens">
      {SCREENS.map((screen) => (
        <button
          key={screen.id}
          type="button"
          className={screen.id === current ? 'tab tab-current' : 'tab'}
          // Tells screen readers which tab is the open one.
          aria-current={screen.id === current ? 'page' : undefined}
          onClick={() => onChange(screen.id)}
        >
          {screen.name}
        </button>
      ))}
    </nav>
  )
}
