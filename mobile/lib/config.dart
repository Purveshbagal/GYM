import 'package:flutter/foundation.dart' show kIsWeb;

/// Points at the Next.js backend.
/// - Flutter Web (Chrome): reaches the host machine directly via localhost.
/// - Android emulator: needs 10.0.2.2, since the emulator's own
///   127.0.0.1/localhost refers to the emulator itself, not the host.
/// - A physical phone or the terminal's own network needs the machine's
///   LAN IP instead — pass it with `--dart-define=API_BASE_URL=http://<lan-ip>:3000`.
class AppConfig {
  static const String _override = String.fromEnvironment('API_BASE_URL', defaultValue: '');

  static String get apiBaseUrl {
    if (_override.isNotEmpty) return _override;
    return kIsWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000';
  }
}
