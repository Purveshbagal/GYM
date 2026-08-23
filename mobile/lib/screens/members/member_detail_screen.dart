import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/member.dart';
import '../../models/plan.dart';
import '../../providers/member_provider.dart';
import '../../providers/plan_provider.dart';
import '../../theme.dart';
import '../../widgets/status_badge.dart';

class MemberDetailScreen extends StatefulWidget {
  final String memberId;
  const MemberDetailScreen({super.key, required this.memberId});

  @override
  State<MemberDetailScreen> createState() => _MemberDetailScreenState();
}

class _MemberDetailScreenState extends State<MemberDetailScreen> {
  Member? _member;
  List<dynamic> _payments = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await context.read<MemberProvider>().fetchMemberDetail(widget.memberId);
    setState(() {
      _member = Member.fromJson(res['member']);
      _payments = res['payments'] ?? [];
      _loading = false;
    });
  }

  Future<void> _renew() async {
    await context.read<PlanProvider>().fetchPlans();
    final plans = context.read<PlanProvider>().plans;
    MembershipPlan? selected = plans.firstWhere(
      (p) => p.id == _member?.currentPlan?.id,
      orElse: () => plans.first,
    );
    final amountController = TextEditingController(text: selected.fees.toStringAsFixed(0));

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Renew Membership'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<MembershipPlan>(
                initialValue: selected,
                decoration: const InputDecoration(labelText: 'Plan'),
                items: plans.map((p) => DropdownMenuItem(value: p, child: Text('${p.name} — ₹${p.fees.toStringAsFixed(0)}'))).toList(),
                onChanged: (v) => setDialogState(() {
                  selected = v;
                  amountController.text = v?.fees.toStringAsFixed(0) ?? '';
                }),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: amountController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Amount Paid', prefixText: '₹ '),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Renew')),
          ],
        ),
      ),
    );

    if (confirmed == true && selected != null) {
      await context.read<MemberProvider>().renewMembership(
            widget.memberId,
            planId: selected!.id,
            amountPaid: double.tryParse(amountController.text),
          );
      _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Membership renewed')));
    }
  }

  Future<void> _toggleAccess(bool enable) async {
    await context.read<MemberProvider>().toggleAccess(widget.memberId, enable);
    _load();
  }

  Future<void> _markEnrolled() async {
    await context.read<MemberProvider>().markEnrolled(widget.memberId);
    _load();
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Member'),
        content: const Text('This removes the member from the app and the door device. Continue?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed == true) {
      await context.read<MemberProvider>().deleteMember(widget.memberId);
      if (mounted) Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _member == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final m = _member!;
    final dateFmt = DateFormat('dd MMM yyyy');
    final isActive = m.status == 'active';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Member Details'),
        actions: [
          IconButton(icon: const Icon(Icons.delete_outline, color: AppColors.danger), onPressed: _delete),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Hero card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 28,
                          backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                          child: Text(
                            m.name.isNotEmpty ? m.name[0].toUpperCase() : '?',
                            style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 20),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(m.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                              const SizedBox(height: 3),
                              Text('Device ID ${m.deviceUserId}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5)),
                            ],
                          ),
                        ),
                        StatusBadge(status: m.status),
                      ],
                    ),
                    if (isActive) ...[
                      const SizedBox(height: 16),
                      const Divider(),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            '${m.daysLeft}',
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w800,
                              color: m.daysLeft <= 7 ? AppColors.warning : AppColors.success,
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Padding(
                            padding: EdgeInsets.only(top: 6),
                            child: Text('days remaining', style: TextStyle(color: AppColors.textSecondary)),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _row(Icons.phone_outlined, 'Phone', m.phone),
                    if (m.email != null) _row(Icons.mail_outline, 'Email', m.email!),
                    _row(Icons.card_membership_outlined, 'Plan', m.currentPlan?.name ?? '-'),
                    _row(Icons.play_circle_outline, 'Start', m.membershipStart != null ? dateFmt.format(m.membershipStart!) : '-'),
                    _row(Icons.event_busy_outlined, 'Expiry', m.membershipEnd != null ? dateFmt.format(m.membershipEnd!) : '-', last: true),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                leading: Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: (m.biometricEnrolled ? AppColors.success : AppColors.textSecondary).withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    m.biometricEnrolled ? Icons.fingerprint : Icons.fingerprint_outlined,
                    color: m.biometricEnrolled ? AppColors.success : AppColors.textSecondary,
                  ),
                ),
                title: Text(
                  m.biometricEnrolled ? 'Biometric enrolled' : 'Not yet enrolled',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
                ),
                subtitle: const Text('On the door terminal', style: TextStyle(fontSize: 12)),
                trailing: m.biometricEnrolled
                    ? const Icon(Icons.check_circle, color: AppColors.success, size: 20)
                    : TextButton(onPressed: _markEnrolled, child: const Text('Mark Done')),
              ),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _renew,
              icon: const Icon(Icons.refresh),
              label: const Text('Renew Membership'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => _toggleAccess(!isActive),
              style: OutlinedButton.styleFrom(
                foregroundColor: isActive ? AppColors.danger : AppColors.success,
                side: BorderSide(color: isActive ? AppColors.danger : AppColors.success),
              ),
              icon: Icon(isActive ? Icons.block : Icons.check_circle_outline),
              label: Text(isActive ? 'Suspend Access' : 'Restore Access'),
            ),
            const SizedBox(height: 24),
            const Text('Payment History', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            if (_payments.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Text('No payments recorded yet', style: TextStyle(color: AppColors.textSecondary)),
              )
            else
              Card(
                child: Column(
                  children: List.generate(_payments.length, (i) {
                    final p = _payments[i];
                    final amount = p['amount'];
                    final type = p['type'];
                    final paidAt = DateTime.tryParse(p['paidAt'] ?? '');
                    final isLast = i == _payments.length - 1;
                    return Column(
                      children: [
                        ListTile(
                          leading: Container(
                            width: 36,
                            height: 36,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: AppColors.accent.withValues(alpha: 0.12), shape: BoxShape.circle),
                            child: Icon(
                              type == 'renewal' ? Icons.autorenew : Icons.person_add,
                              size: 18,
                              color: AppColors.accent,
                            ),
                          ),
                          title: Text('₹$amount', style: const TextStyle(fontWeight: FontWeight.w700)),
                          subtitle: Text(type == 'renewal' ? 'Renewal' : 'New membership', style: const TextStyle(fontSize: 12)),
                          trailing: Text(
                            paidAt != null ? dateFmt.format(paidAt) : '',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                          dense: true,
                        ),
                        if (!isLast) const Divider(height: 1, indent: 16, endIndent: 16),
                      ],
                    );
                  }),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _row(IconData icon, String label, String value, {bool last = false}) {
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 12),
      child: Row(
        children: [
          Icon(icon, size: 17, color: AppColors.textSecondary),
          const SizedBox(width: 10),
          Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13.5)),
          const Spacer(),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
        ],
      ),
    );
  }
}
