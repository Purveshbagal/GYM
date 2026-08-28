import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config.dart';
import '../../providers/auth_provider.dart';
import '../../theme.dart';
import '../devices/devices_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: AppGradients.hero,
              borderRadius: BorderRadius.circular(28),
            ),
            child: Row(
              children: [
                Container(
                  width: 62,
                  height: 62,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
                  ),
                  child: Text(
                    (auth.name?.isNotEmpty == true ? auth.name![0] : '?').toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 22),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        auth.name ?? '',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 20),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${auth.role ?? ''} • ${auth.username ?? ''}',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.78), fontSize: 12.5),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Workspace',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 10),
          Card(
            child: Column(
              children: [
                _tile(
                  context,
                  icon: Icons.fingerprint_rounded,
                  color: AppColors.primary,
                  title: 'Biometric Terminals',
                  subtitle: 'Manage door devices and ISAPI credentials',
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const DevicesScreen())),
                ),
                const Divider(height: 1, indent: 70),
                _tile(
                  context,
                  icon: Icons.dns_outlined,
                  color: AppColors.accent,
                  title: 'Backend URL',
                  subtitle: AppConfig.apiBaseUrl,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Account',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 10),
          Card(
            child: _tile(
              context,
              icon: Icons.logout_rounded,
              color: AppColors.danger,
              title: 'Logout',
              titleColor: AppColors.danger,
              subtitle: 'Securely sign out from this device',
              onTap: () => context.read<AuthProvider>().logout(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tile(
    BuildContext context, {
    required IconData icon,
    required Color color,
    required String title,
    String? subtitle,
    Color? titleColor,
    VoidCallback? onTap,
  }) {
    return ListTile(
      leading: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Icon(icon, color: color, size: 20),
      ),
      title: Text(
        title,
        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, color: titleColor ?? AppColors.textPrimary),
      ),
      subtitle: subtitle != null ? Text(subtitle, style: const TextStyle(fontSize: 12.5)) : null,
      trailing: onTap != null ? const Icon(Icons.arrow_forward_ios_rounded, color: AppColors.textMuted, size: 16) : null,
      onTap: onTap,
    );
  }
}
