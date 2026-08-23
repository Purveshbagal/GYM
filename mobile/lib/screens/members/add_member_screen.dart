import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/member_provider.dart';
import '../../providers/plan_provider.dart';
import '../../providers/device_provider.dart';
import '../../models/plan.dart';
import '../../models/device.dart';
import '../../services/api_service.dart';
import '../../theme.dart';

class AddMemberScreen extends StatefulWidget {
  const AddMemberScreen({super.key});

  @override
  State<AddMemberScreen> createState() => _AddMemberScreenState();
}

class _AddMemberScreenState extends State<AddMemberScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _amount = TextEditingController();
  String _gender = 'male';
  String _paymentMethod = 'cash';
  MembershipPlan? _plan;
  GymDevice? _device;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await context.read<PlanProvider>().fetchPlans();
      await context.read<DeviceProvider>().fetchDevices();
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _plan == null) return;
    setState(() => _loading = true);
    try {
      final res = await context.read<MemberProvider>().createMember(
            name: _name.text.trim(),
            phone: _phone.text.trim(),
            email: _email.text.trim().isEmpty ? null : _email.text.trim(),
            gender: _gender,
            planId: _plan!.id,
            amountPaid: _amount.text.isEmpty ? _plan!.fees : double.tryParse(_amount.text),
            paymentMethod: _paymentMethod,
            deviceId: _device?.id,
          );
      if (mounted) {
        final deviceUserId = res['deviceUserId'];
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Member added. Device ID: $deviceUserId — enroll face/fingerprint on the terminal using this ID.'),
            duration: const Duration(seconds: 6),
          ),
        );
      }
    } on ApiException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final plans = context.watch<PlanProvider>().plans;
    final devices = context.watch<DeviceProvider>().devices;

    return Scaffold(
      appBar: AppBar(title: const Text('New Member')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _SectionCard(
              title: 'Personal Information',
              icon: Icons.person_outline,
              children: [
                TextFormField(
                  controller: _name,
                  decoration: const InputDecoration(labelText: 'Full Name', prefixIcon: Icon(Icons.badge_outlined)),
                  validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Phone', prefixIcon: Icon(Icons.phone_outlined)),
                  validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _email,
                  decoration: const InputDecoration(labelText: 'Email (optional)', prefixIcon: Icon(Icons.mail_outline)),
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  initialValue: _gender,
                  decoration: const InputDecoration(labelText: 'Gender', prefixIcon: Icon(Icons.wc_outlined)),
                  items: const [
                    DropdownMenuItem(value: 'male', child: Text('Male')),
                    DropdownMenuItem(value: 'female', child: Text('Female')),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                  ],
                  onChanged: (v) => setState(() => _gender = v ?? 'male'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _SectionCard(
              title: 'Membership Plan',
              icon: Icons.card_membership_outlined,
              children: [
                DropdownButtonFormField<MembershipPlan>(
                  initialValue: _plan,
                  decoration: const InputDecoration(labelText: 'Select Plan', prefixIcon: Icon(Icons.event_available_outlined)),
                  items: plans
                      .map((p) => DropdownMenuItem(value: p, child: Text('${p.name} — ₹${p.fees.toStringAsFixed(0)}')))
                      .toList(),
                  onChanged: (v) => setState(() {
                    _plan = v;
                    _amount.text = v?.fees.toStringAsFixed(0) ?? '';
                  }),
                  validator: (v) => v == null ? 'Select a plan' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _amount,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Amount Paid', prefixText: '₹ ', prefixIcon: Icon(Icons.currency_rupee)),
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  initialValue: _paymentMethod,
                  decoration: const InputDecoration(labelText: 'Payment Method', prefixIcon: Icon(Icons.payments_outlined)),
                  items: const [
                    DropdownMenuItem(value: 'cash', child: Text('Cash')),
                    DropdownMenuItem(value: 'card', child: Text('Card')),
                    DropdownMenuItem(value: 'upi', child: Text('UPI')),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                  ],
                  onChanged: (v) => setState(() => _paymentMethod = v ?? 'cash'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _SectionCard(
              title: 'Biometric Terminal',
              icon: Icons.fingerprint,
              children: [
                DropdownButtonFormField<GymDevice>(
                  initialValue: _device,
                  decoration: const InputDecoration(labelText: 'Door Device (optional)', prefixIcon: Icon(Icons.sensor_door_outlined)),
                  items: devices.map((d) => DropdownMenuItem(value: d, child: Text('${d.name} (${d.ip})'))).toList(),
                  onChanged: (v) => setState(() => _device = v),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline, size: 16, color: AppColors.primary),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Face/fingerprint is captured directly on the terminal by staff, using the Device ID shown after saving.',
                          style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Save Member'),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;
  const _SectionCard({required this.title, required this.icon, required this.children});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: AppColors.primary),
                const SizedBox(width: 8),
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
              ],
            ),
            const SizedBox(height: 16),
            ...children,
          ],
        ),
      ),
    );
  }
}
