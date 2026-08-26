import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/access_log.dart';
import '../../services/api_service.dart';
import '../../theme.dart';

class AccessLogsScreen extends StatefulWidget {
  const AccessLogsScreen({super.key});

  @override
  State<AccessLogsScreen> createState() => _AccessLogsScreenState();
}

class _AccessLogsScreenState extends State<AccessLogsScreen> {
  List<AccessLogEntry> _logs = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiService.instance.get('/api/logs');
      if (!mounted) return;
      setState(() => _logs = (res['logs'] as List).map((e) => AccessLogEntry.fromJson(e)).toList());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('dd MMM, hh:mm a');
    return Scaffold(
      appBar: AppBar(title: const Text('Door Access Logs')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                children: [
                  const _LogsHero(),
                  const SizedBox(height: 16),
                  if (_logs.isEmpty)
                    const _LogsEmptyState()
                  else
                    ..._logs.map((log) {
                      final granted = log.result == 'granted';
                      final color = granted ? AppColors.success : AppColors.danger;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                Container(
                                  width: 52,
                                  height: 52,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: color.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(18),
                                  ),
                                  child: Icon(
                                    granted ? Icons.lock_open_rounded : Icons.lock_outline_rounded,
                                    color: color,
                                    size: 22,
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        log.memberName ?? 'Unknown member',
                                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5),
                                      ),
                                      const SizedBox(height: 5),
                                      Text(
                                        'Employee ID ${log.employeeNo ?? '-'}',
                                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        '${log.verifyMode ?? 'No verify mode'} • ${log.reason ?? 'No reason captured'}',
                                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: color.withValues(alpha: 0.11),
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      child: Text(
                                        granted ? 'Granted' : 'Denied',
                                        style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 11.5),
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    Text(
                                      fmt.format(log.occurredAt),
                                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 11.5),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}

class _LogsHero extends StatelessWidget {
  const _LogsHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppGradients.hero,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Access Monitoring',
            style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -0.7),
          ),
        ],
      ),
    );
  }
}

class _LogsEmptyState extends StatelessWidget {
  const _LogsEmptyState();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
        child: Column(
          children: [
            Container(
              width: 72,
              height: 72,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(22),
              ),
              child: const Icon(Icons.fingerprint_rounded, size: 34, color: AppColors.primary),
            ),
            const SizedBox(height: 16),
            const Text('No access events yet', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            const Text(
              'Door activity will appear here as soon as members start scanning in.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
