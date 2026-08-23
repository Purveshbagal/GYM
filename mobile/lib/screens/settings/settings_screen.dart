import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../config.dart';
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
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                    child: Text(
                      (auth.name?.isNotEmpty == true ? auth.name![0] : '?').toUpperCase(),
                      style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 18),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(auth.name ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      const SizedBox(height: 3),
                      Text(
                        '${auth.role ?? ''} • ${auth.username ?? ''}',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 8),
            child: Text('GENERAL', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.textSecondary, letterSpacing: 0.6)),
          ),
          Card(
            child: Column(
              children: [
                _tile(
                  context,
                  icon: Icons.fingerprint,
                  color: AppColors.primary,
                  title: 'Biometric Terminals',
                  subtitle: 'Manage door devices & ISAPI credentials',
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const DevicesScreen())),
                ),
                const Divider(height: 1, indent: 60),
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
          const SizedBox(height: 24),
          Card(
            child: _tile(
              context,
              icon: Icons.logout,
              color: AppColors.danger,
              title: 'Logout',
              titleColor: AppColors.danger,
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
        width: 38,
        height: 38,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, color: color, size: 19),
      ),
      title: Text(title, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: titleColor)),
      subtitle: subtitle != null ? Text(subtitle, style: const TextStyle(fontSize: 12)) : null,
      trailing: onTap != null ? const Icon(Icons.chevron_right, color: AppColors.textSecondary, size: 20) : null,
      onTap: onTap,
    );
  }
}
