import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../widgets/stat_card.dart';
import 'members/add_member_screen.dart';
import 'members/member_list_screen.dart';
import 'logs/access_logs_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _stats;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiService.instance.get('/api/dashboard/stats');
      setState(() => _stats = res);
    } catch (e) {
      setState(() => _error = 'Could not load stats');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final greeting = _greeting();
    final dateStr = DateFormat('EEEE, d MMMM').format(DateTime.now());

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _Header(greeting: greeting, name: auth.name, dateStr: dateStr)),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              sliver: SliverToBoxAdapter(
                child: _loading
                    ? const Padding(
                        padding: EdgeInsets.symmetric(vertical: 80),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    : _error != null
                        ? Padding(
                            padding: const EdgeInsets.symmetric(vertical: 60),
                            child: Center(child: Text(_error!, style: const TextStyle(color: AppColors.textSecondary))),
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _QuickActions(),
                              const SizedBox(height: 24),
                              const Text('Overview', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                              const SizedBox(height: 12),
                              GridView.count(
                                crossAxisCount: 2,
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                mainAxisSpacing: 12,
                                crossAxisSpacing: 12,
                                childAspectRatio: 2.3,
                                children: [
                                  StatCard(label: 'Total Members', value: '${_stats?['totalMembers'] ?? 0}', icon: Icons.people, color: AppColors.primary),
                                  StatCard(label: 'Active', value: '${_stats?['activeMembers'] ?? 0}', icon: Icons.check_circle, color: AppColors.success),
                                  StatCard(label: 'Expired', value: '${_stats?['expiredMembers'] ?? 0}', icon: Icons.cancel, color: AppColors.danger),
                                  StatCard(label: 'Expiring in 7d', value: '${_stats?['expiringSoon'] ?? 0}', icon: Icons.warning_amber, color: AppColors.warning),
                                  StatCard(label: 'Revenue (month)', value: '₹${_stats?['revenueThisMonth'] ?? 0}', icon: Icons.currency_rupee, color: AppColors.accent),
                                  StatCard(label: "Today's Visits", value: '${_stats?['todayVisits'] ?? 0}', icon: Icons.fingerprint, color: const Color(0xFF0D9488)),
                                ],
                              ),
                            ],
                          ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
}

class _Header extends StatelessWidget {
  final String greeting;
  final String? name;
  final String dateStr;
  const _Header({required this.greeting, required this.name, required this.dateStr});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 56, 20, 28),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary, AppColors.primaryDark],
        ),
        borderRadius: BorderRadius.only(bottomLeft: Radius.circular(28), bottomRight: Radius.circular(28)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(dateStr, style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12.5)),
                const SizedBox(height: 4),
                Text(
                  '$greeting, ${name ?? 'Admin'}',
                  style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ),
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
            ),
            child: const Icon(Icons.fitness_center, color: Colors.white, size: 24),
          ),
        ],
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionTile(
            icon: Icons.person_add_alt_1,
            label: 'Add Member',
            color: AppColors.primary,
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AddMemberScreen())),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _ActionTile(
            icon: Icons.people_outline,
            label: 'Members',
            color: AppColors.accent,
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const MemberListScreen())),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _ActionTile(
            icon: Icons.fingerprint,
            label: 'Access Logs',
            color: const Color(0xFF0D9488),
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AccessLogsScreen())),
          ),
        ),
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionTile({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surfaceAlt,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
          child: Column(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
