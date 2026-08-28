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
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Plan Name')),
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
                decoration: const InputDecoration(labelText: 'Fees', prefixText: 'Rs '),
              ),
              const SizedBox(height: 12),
              TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Description')),
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
      if (!mounted) return;
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
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: FilledButton.tonalIcon(
              onPressed: () => _showPlanDialog(),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('New'),
            ),
          ),
        ],
      ),
      body: provider.loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
              children: [
                const _PlansHero(),
                const SizedBox(height: 16),
                if (provider.plans.isEmpty)
                  const _PlansEmptyState()
                else
                  ...provider.plans.map((p) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _PlanCard(
                          plan: p,
                          onEdit: () => _showPlanDialog(existing: p),
                          onDelete: () => context.read<PlanProvider>().deactivatePlan(p.id),
                        ),
                      )),
              ],
            ),
    );
  }
}

class _PlansHero extends StatelessWidget {
  const _PlansHero();

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
            'Premium Pricing Stack',
            style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -0.7),
          ),
          const SizedBox(height: 8),
          Text(
            'Create structured plans that look professional and are easy for staff to explain and renew.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.82), fontSize: 13, height: 1.5),
          ),
        ],
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final MembershipPlan plan;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _PlanCard({
    required this.plan,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(Icons.workspace_premium_rounded, color: AppColors.primary, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(plan.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 6),
                  Text(
                    '${plan.durationMonths} month(s)',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5),
                  ),
                  if (plan.description != null && plan.description!.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      plan.description!,
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5, height: 1.4),
                    ),
                  ],
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'Rs ${plan.fees.toStringAsFixed(0)}',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit_outlined, size: 18, color: AppColors.textSecondary),
                      onPressed: onEdit,
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.danger),
                      onPressed: onDelete,
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PlansEmptyState extends StatelessWidget {
  const _PlansEmptyState();

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
              child: const Icon(Icons.workspace_premium_outlined, size: 34, color: AppColors.primary),
            ),
            const SizedBox(height: 16),
            const Text('No plans yet', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            const Text(
              'Add your first membership plan to start charging with a cleaner professional structure.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
