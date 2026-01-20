# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-19

### Added
- **Character Management System**
  - Create, edit, and delete characters
  - Support for multiple character types: Jogador (Player), Inimigo (Enemy), Aliado (Friendly), and Neutro (Neutral)
  - Character avatars with URL or file upload support
  - Option to hide character values for NPCs

- **Combat System**
  - Combat mode with preparation and active phases
  - Initiative-based turn order
  - Turn management with "Passar Turno" button
  - Visual turn indicator with orange halo glow effect
  - Turn order sorting and management

- **Battlefield Tracker**
  - 5 distance zones (Faixa 1-5) for tactical positioning
  - Drag-and-drop character positioning
  - Visual representation with character avatars
  - Current turn character highlighting on battlefield

- **Status Tracking**
  - Three resource bars: Pontos de Vida (Health), Pontos de Mana (Mana), and Pontos de Ação (Action Points)
  - Automatic maximum calculation based on character stats:
    - Vida: Resistência × 5
    - Mana: Habilidade × 5
    - Ação: Poder
  - Double-click to modify values with relative (+/-) or absolute values
  - Visual animations for status changes:
    - Green swipe for healing
    - Red swipe for damage
    - Blue swipe for mana recovery
    - Black swipe for mana spent
    - Yellow/amber swipe for action points spent/recovered

- **Visual Features**
  - "Perto da Morte" warning: Red pulsing animation when health ≤ Resistência
  - Current turn glow: Orange halo effect (#FAA519) with multi-layer animation
  - Character type-based color coding
  - Smooth transitions and animations throughout

- **Theme System**
  - Dark mode (default) with pitch black background (#000000)
  - Light mode option
  - Orange accent color (#FAA519) in dark mode
  - Theme preference saved in localStorage

- **Typography**
  - Custom Microgramma D Extended Bold font for title and buttons
  - Uppercase styling for all buttons
  - Consistent letter spacing

- **Data Management**
  - LocalStorage persistence for character data
  - JSON export/import functionality
  - Automatic data merging between JSON file and localStorage

- **User Interface**
  - Responsive design for desktop and tablet
  - Modal system for character creation and editing
  - Intuitive drag-and-drop interface
  - Keyboard shortcuts (Enter to confirm, Escape to close)

### Technical Details
- Pure JavaScript implementation (no frameworks)
- CSS Grid and Flexbox for layout
- CSS animations and transitions
- HTML5 Drag and Drop API
- LocalStorage API for data persistence
- Works offline after initial load

### Design
- Dracula-inspired color scheme
- Modern, clean interface
- High contrast for accessibility
- Smooth animations and transitions
- Visual feedback for all interactions

---

## Version History

- **1.0.0** - Initial stable release

[1.0.0]: https://github.com/yourusername/3DeT-Victory-Tracker/releases/tag/v1.0.0
