import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/plan.dart';
import '../../providers/plan_provider.dart';
import '../../theme.dart';

class PlansScreen extends StatefulWidget {
  const PlansScreen({super.key});

  @override
  State<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends State<PlansScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<PlanProvider>().fetchPlans());
  }

  Future<void> _showPlanDialog({MembershipPlan? existing}) async {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final monthsCtrl = TextEditingController(text: existing?.durationMonths.toString() ?? '');
    final feesCtrl = TextEditingController(text: existing?.fees.toStringAsFixed(0) ?? '');
    final descCtrl = TextEditingController(text: existing?.description ?? '');

    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(existing == null ? 'New Plan' : 'Edit Plan'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Plan Name (e.g. 3 Month)')),
              const SizedBox(height: 12),
              TextField(
                controller: monthsCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Duration (months)'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: feesCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Fees', prefixText: '₹ '),
              ),
              const SizedBox(height: 12),
              TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Description (optional)')),
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
      final provider = context.read<PlanProvider>();
      final data = {
        'name': nameCtrl.text.trim(),
        'durationMonths': int.tryParse(monthsCtrl.text) ?? 1,
        'fees': double.tryParse(feesCtrl.text) ?? 0,
        'description': descCtrl.text.trim(),
      };
      if (existing == null) {
        await provider.createPlan(
          name: data['name'] as String,
          durationMonths: data['durationMonths'] as int,
          fees: data['fees'] as double,
          description: data['description'] as String,
        );
      } else {
        await provider.updatePlan(existing.id, data);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PlanProvider>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Plans & Fees'),
        actions: [
          IconButton(icon: const Icon(Icons.add_circle_outline), onPressed: () => _showPlanDialog()),
          const SizedBox(width: 4),
        ],
      ),
      body: provider.loading
          ? const Center(child: CircularProgressIndicator())
          : provider.plans.isEmpty
              ? const Center(
                  child: Text('No plans yet. Tap + to add one.', style: TextStyle(color: AppColors.textSecondary)),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: provider.plans.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final p = provider.plans[i];
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
                        child: Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                              child: const Icon(Icons.card_membership, color: AppColors.primary, size: 20),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${p.durationMonths} month(s)${p.description != null && p.description!.isNotEmpty ? ' • ${p.description}' : ''}',
                                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5),
                                  ),
                                ],
                              ),
                            ),
                            Text('₹${p.fees.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                            IconButton(
                              icon: const Icon(Icons.edit_outlined, size: 18, color: AppColors.textSecondary),
                              onPressed: () => _showPlanDialog(existing: p),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.danger),
                              onPressed: () => context.read<PlanProvider>().deactivatePlan(p.id),
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
