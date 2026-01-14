# Change Log

All notable changes to the "safe-environment" extension will be documented in this file.

## [2.0.0] - 2026-01-14

### Added
- Support for 30+ sensitive file types beyond `.env`:
  - Environment files: `.env*`, `.envrc`, `*.local`
  - Credentials: `.netrc`, `.npmrc`, `.pypirc`, `.docker/config.json`, `credentials.json`, `secrets.json`
  - Private keys: `*.pem`, `*.key`, `*.p12`, `*.pfx`
  - Cloud configs: `.aws/credentials`, `.gcloud/credentials.db`, `.azure/credentials`, `service-account*.json`, `kubeconfig`
  - Git: `.git-credentials`, `.github/secrets`
  - Application: `wp-config.php`, `.htpasswd`
- Visual Settings page (Command: `Safe Environment: Open Settings`)
  - Toggle built-in patterns on/off with checkboxes
  - Add/remove custom regex patterns
  - Master enable/disable switch
- Quick Toggle menu (Command: `Safe Environment: Quick Toggle Patterns`)
  - Fast pattern toggling via command palette
  - Add custom patterns on the fly
- User-configurable settings:
  - `safeEnvironment.enabled`: Enable/disable the extension
  - `safeEnvironment.additionalPatterns`: Add custom file patterns
  - `safeEnvironment.disabledPatterns`: Disable specific built-in patterns

### Changed
- Warning panel now shows relative path instead of full absolute path
- Simplified architecture: removed custom editor provider in favor of webview panels

### Removed
- Removed `customEditors` contribution (no longer needed)

## [1.0.0] - 2026-01-12

### Added
- Initial release
- Automatic interception of .env file openings
- Warning screen with option to proceed or cancel
- Full-page custom editor for sensitive file warnings
- Error handling for robust operation
