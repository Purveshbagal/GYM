import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/device_provider.dart';
import '../../services/api_service.dart';
import '../../theme.dart';

class DevicesScreen extends StatefulWidget {
  const DevicesScreen({super.key});

  @override
  State<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends State<DevicesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<DeviceProvider>().fetchDevices());
  }

  Future<void> _addDevice() async {
    final nameCtrl = TextEditingController();
    final ipCtrl = TextEditingController();
    final portCtrl = TextEditingController(text: '80');
    final userCtrl = TextEditingController(text: 'admin');
    final passCtrl = TextEditingController();
    final locationCtrl = TextEditingController();

    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Biometric Terminal'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name (e.g. Main Entrance)')),
              const SizedBox(height: 10),
              TextField(controller: ipCtrl, decoration: const InputDecoration(labelText: 'Device IP Address')),
              const SizedBox(height: 10),
              TextField(controller: portCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Port')),
              const SizedBox(height: 10),
              TextField(controller: userCtrl, decoration: const InputDecoration(labelText: 'ISAPI Username')),
              const SizedBox(height: 10),
              TextField(controller: passCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'ISAPI Password')),
              const SizedBox(height: 10),
              TextField(controller: locationCtrl, decoration: const InputDecoration(labelText: 'Location (optional)')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Save')),
        ],
      ),
    );

    if (saved == true) {
      try {
        await context.read<DeviceProvider>().addDevice(
              name: nameCtrl.text.trim(),
              ip: ipCtrl.text.trim(),
              port: int.tryParse(portCtrl.text) ?? 80,
              username: userCtrl.text.trim(),
              password: passCtrl.text,
              location: locationCtrl.text.trim(),
            );
      } on ApiException catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _deleteDevice(String id, String name) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Terminal'),
        content: Text('Remove "$name" from the app? Members already enrolled on it are not affected.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed == true) {
      await context.read<DeviceProvider>().deleteDevice(id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<DeviceProvider>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Biometric Terminals'),
        actions: [
          IconButton(icon: const Icon(Icons.add_circle_outline), onPressed: _addDevice),
          const SizedBox(width: 4),
        ],
      ),
      body: provider.loading
          ? const Center(child: CircularProgressIndicator())
          : provider.devices.isEmpty
              ? const Center(
                  child: Text('No terminals added yet. Tap + to add one.', style: TextStyle(color: AppColors.textSecondary)),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: provider.devices.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final d = provider.devices[i];
                    final statusColor = d.online ? AppColors.success : AppColors.textSecondary;
                    return Card(
                      child: ListTile(
                        leading: Container(
                          width: 42,
                          height: 42,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), shape: BoxShape.circle),
                          child: Icon(Icons.fingerprint, color: statusColor),
                        ),
                        title: Text(d.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        subtitle: Text(
                          '${d.ip}:${d.port}${d.location != null && d.location!.isNotEmpty ? ' • ${d.location}' : ''} • ${d.online ? 'Online' : 'Offline'}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.sync, color: AppColors.primary),
                              onPressed: () => context.read<DeviceProvider>().syncDevice(d.id),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline_rounded, color: AppColors.danger),
                              onPressed: () => _deleteDevice(d.id, d.name),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
