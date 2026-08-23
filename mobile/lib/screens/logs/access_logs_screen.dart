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
          : _logs.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 72,
                        height: 72,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.08), shape: BoxShape.circle),
                        child: const Icon(Icons.fingerprint, size: 34, color: AppColors.primary),
                      ),
                      const SizedBox(height: 16),
                      const Text('No access events yet', style: TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      const Text('Door activity will show up here', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _logs.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final log = _logs[i];
                      final granted = log.result == 'granted';
                      final color = granted ? AppColors.success : AppColors.danger;
                      return Card(
                        child: ListTile(
                          leading: Container(
                            width: 42,
                            height: 42,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
                            child: Icon(granted ? Icons.lock_open : Icons.lock_outline, color: color, size: 20),
                          ),
                          title: Text(
                            log.memberName ?? 'Unknown (ID ${log.employeeNo ?? '-'})',
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                          ),
                          subtitle: Text(
                            '${log.verifyMode ?? ''} • ${log.reason ?? ''}'.trim(),
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                          trailing: Text(
                            fmt.format(log.occurredAt),
                            style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
