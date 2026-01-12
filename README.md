# Safe Environment

A VSCode extension that protects you from accidentally exposing sensitive information in `.env` files during livestreams, screen recordings, or screen sharing sessions.

## Features

- **Automatic Protection**: Intercepts `.env` file openings and displays a warning screen instead
- **One-Click Override**: Easy to bypass the warning when you actually need to edit environment files
- **Stream-Safe**: Prevents accidental exposure of API keys, tokens, and secrets during live coding sessions

## How It Works

When you try to open a `.env` file, Safe Environment automatically:

1. Closes the standard text editor
2. Displays a full-page warning about the sensitive nature of the file
3. Gives you two options:
   - **Open Anyway**: Proceed to edit the file (use when not streaming)
   - **Cancel**: Close the warning and keep your secrets safe

## Use Cases

Perfect for:
- Content creators and streamers who code live
- Screen sharing during meetings or presentations
- Recording coding tutorials
- Pair programming sessions
- Any situation where your screen is visible to others

## Installation

Install directly from the VSCode Marketplace or search for "Safe Environment" in the Extensions view.

## Usage

No configuration needed! The extension automatically activates when VSCode starts and monitors for `.env` file access.

## Contributing

Found a bug or have a feature request? Please open an issue on [GitHub](https://github.com/antoinedespres/safe-environment/issues).

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Privacy

This extension runs entirely locally and does not collect, transmit, or store any of your data.
