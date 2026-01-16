# 3DeT Victory Tracker

A comprehensive web-based tool for tracking character status, managing combat turns, and visualizing battlefield positions in tabletop RPG sessions. Built with vanilla HTML, CSS, and JavaScript.

![RPG Status Tracker](https://img.shields.io/badge/Status-Active-success)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

### 🎭 Character Management
- **Create and manage multiple characters** with customizable stats
- **Character types**: Player characters, enemies, friendly NPCs, and neutral NPCs
- **Visual distinction**: Color-coded cards for different character types
- **Avatar support**: Upload or link character images
- **Hidden values mode**: Option to hide stats from players

### ⚔️ Combat Mode
- **Initiative-based turn order**: Sort characters by initiative values
- **Turn tracking**: Visual glow effect highlights the current character's turn
- **Smooth animations**: Animated transitions when passing turns
- **Combat UI**: Dedicated combat controls and turn order display

### 🗺️ Battlefield Tracker
- **5 distance zones**: Organize characters across different range bands
- **Drag-and-drop positioning**: Move characters between distance zones during combat
- **Visual character representation**: Character avatars displayed as dots on the battlefield
- **Turn synchronization**: Active character's dot glows and pulses on the battlefield
- **Color-coded dots**:
  - 🔴 Red: Enemies
  - 🟢 Green: Friendly NPCs
  - 🔵 Blue: Player characters

### 📊 Status Tracking
- **Health Points (Pontos de Vida)**: Based on Resistance × 5
- **Mana Points (Pontos de Mana)**: Based on Ability × 5
- **Action Points (Pontos de Ação)**: Based on Power
- **Visual status bars**: Animated progress bars with percentage indicators
- **Quick modifications**: Double-click bars to add/subtract values (+10, -5 format)
- **Visual feedback**: Animated effects for healing, damage, mana changes

### 🎨 User Interface
- **Dark/Light theme**: Toggle between themes with persistent preference
- **Dracula-inspired color scheme**: Beautiful, eye-friendly color palette
- **Responsive design**: Works on desktop and tablet devices
- **Smooth animations**: Polished transitions and visual effects
- **Accessibility**: ARIA labels and keyboard navigation support

### 💾 Data Management
- **LocalStorage persistence**: All data saved automatically in browser
- **JSON import/export**: Load from `characters.json` or export current state
- **Data merging**: Combines JSON file data with localStorage current values

## Getting Started

### Installation

1. Clone or download this repository
2. Open `index.html` in a modern web browser
3. No build process or dependencies required!

### Basic Usage

#### Adding Characters
1. Click the **➕ Adicionar** button
2. Fill in character details:
   - Name
   - Avatar (URL or upload)
   - Character type (Player/Enemy/Friendly/Neutral)
   - Stats: Power, Ability, Resistance
   - Optional: Hide values checkbox
3. Click **Adicionar**

#### Modifying Status Values
- **Double-click** any status bar (Health/Mana/Action)
- Enter a value in format: `+10` (add) or `-5` (subtract)
- Click **Aplicar** or press Enter

#### Changing Avatar
- **Double-click** a character's avatar image
- Enter a URL or upload an image file
- Click **Aplicar**

#### Combat Mode
1. Click **⚔️ Combate!** to activate combat mode
2. Enter initiative values for each character
3. Characters automatically sort by initiative (highest first)
4. Use **⏭️ Passar Turno!** to advance to the next character's turn
5. The **Battlefield Tracker** panel slides in from the right

#### Battlefield Positioning
1. Activate Combat Mode to see the battlefield panel
2. **Drag and drop** character dots between distance zones (Faixa 1-5)
3. Characters can only be moved **during their turn**
4. The active character's dot pulses with a glowing animation

#### Exporting Data
- Click **💾 Exportar** to download current character data as `characters.json`

## Character Data Format

Characters are stored with the following structure:

```json
{
  "id": 1,
  "name": "Character Name",
  "avatar": "https://example.com/avatar.jpg",
  "type": "player",
  "hiddenValues": false,
  "poder": 10,
  "habilidade": 8,
  "resistencia": 12,
  "pontosVida": 60,
  "pontosMana": 40,
  "pontosAcao": 10,
  "iniciativa": 15,
  "battlefieldSection": 2
}
```

### Field Descriptions
- `id`: Unique identifier
- `name`: Character name
- `avatar`: Image URL or data URL
- `type`: `"player"`, `"enemy"`, `"friendly"`, or `"neutral"`
- `hiddenValues`: Boolean to hide stat values
- `poder`: Power stat (affects Action Points)
- `habilidade`: Ability stat (affects Mana Points)
- `resistencia`: Resistance stat (affects Health Points)
- `pontosVida`: Current health (max = resistencia × 5)
- `pontosMana`: Current mana (max = habilidade × 5)
- `pontosAcao`: Current action points (max = poder)
- `iniciativa`: Initiative value for combat order
- `battlefieldSection`: Distance zone (0-4, representing Faixa 1-5)

## File Structure

```
3DeT-Victory-Tracker/
├── index.html          # Main HTML structure
├── styles.css          # All styling and animations
├── script.js           # Application logic and functionality
├── characters.json     # Character data (optional, loads on startup)
├── notes.md            # Campaign notes
└── README.md           # This file
```

## Technical Details

### Technologies Used
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with CSS variables, animations, and transitions
- **Vanilla JavaScript**: No frameworks or dependencies
- **LocalStorage API**: Client-side data persistence
- **Drag and Drop API**: HTML5 drag-and-drop for battlefield positioning

### Browser Compatibility
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (with some limitations)

### Performance
- Lightweight: No external dependencies
- Fast: Pure vanilla JavaScript
- Efficient: LocalStorage for instant data access
- Smooth: CSS animations with hardware acceleration

## Features in Detail

### Status Bar Animations
- **Healing**: Green swipe animation (left to right)
- **Damage**: Red swipe animation (right to left)
- **Mana Spent**: Black swipe animation (right to left)
- **Mana Recovered**: Blue swipe animation (left to right)

### Visual Indicators
- **Current Turn**: Pulsing black glow with animated border
- **Near Death**: Red pulsing animation when health ≤ resistance
- **Battlefield Active Turn**: Pulsing glow with expanding ring animation

### Character Type Colors
- **Enemy**: Red gradient background and border
- **Friendly**: Green gradient background and border
- **Neutral**: Blue gradient background with slight grayscale
- **Player**: Standard background (default)

## Keyboard Shortcuts

- **Enter**: Confirm modal inputs
- **Escape**: Close modals (when clicking outside)

## Tips & Tricks

1. **Quick Health Management**: Double-click health bar and use `+20` or `-15` for quick adjustments
2. **Initiative Setup**: Enter initiative values before clicking "Passar Turno" for proper sorting
3. **Battlefield Organization**: Use the 5 distance zones to track positioning relative to enemies
4. **Theme Switching**: Toggle dark/light mode anytime - preference is saved
5. **Data Backup**: Regularly export your JSON file to preserve character data

## Known Limitations

- Character data is stored in browser localStorage (clears if browser data is cleared)
- No server-side persistence (single-user application)
- Drag-and-drop may have limitations on touch devices
- Avatar images must be accessible URLs or data URLs

## Future Enhancements

Potential features for future versions:
- [ ] Multi-session support
- [ ] Character templates/presets
- [ ] Dice roller integration
- [ ] Status effect tracking
- [ ] Initiative history log
- [ ] Character notes/descriptions
- [ ] Import from other formats
- [ ] Mobile app version

## Contributing

This is a personal project, but suggestions and improvements are welcome!

## License

This project is open source and available under the MIT License.

## Credits

- Built for tabletop RPG sessions
- Dracula color scheme inspiration
- Designed with accessibility in mind

---

**Enjoy your RPG sessions!** 🎲⚔️🗡️
