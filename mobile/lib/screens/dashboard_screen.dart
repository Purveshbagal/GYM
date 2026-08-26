import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../widgets/stat_card.dart';
import 'logs/access_logs_screen.dart';
import 'members/add_member_screen.dart';
import 'members/member_list_screen.dart';

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
      if (!mounted) return;
      setState(() => _stats = res);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not load dashboard insights');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final greeting = _greeting();
    final dateStr = DateFormat('EEEE, d MMMM').format(DateTime.now());
    final stats = _stats ?? const <String, dynamic>{};

    return RefreshIndicator(
      onRefresh: _load,
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          SliverToBoxAdapter(
            child: _DashboardHero(
              greeting: greeting,
              name: auth.name ?? 'Admin',
              dateStr: dateStr,
              totalMembers: '${stats['totalMembers'] ?? 0}',
              revenue: 'Rs ${stats['revenueThisMonth'] ?? 0}',
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 120),
            sliver: SliverToBoxAdapter(
              child: _loading
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 100),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  : _error != null
                      ? _DashboardError(message: _error!, onRetry: _load)
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const _QuickActions(),
                            const SizedBox(height: 24),
                            const _SectionTitle(
                              eyebrow: 'Performance',
                              title: 'Business snapshot',
                              subtitle: 'Membership movement, revenue and live gym usage in one place.',
                            ),
                            const SizedBox(height: 16),
                            GridView.count(
                              crossAxisCount: MediaQuery.of(context).size.width > 720 ? 3 : 2,
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              mainAxisSpacing: 12,
                              crossAxisSpacing: 12,
                              childAspectRatio: 1.5,
                              children: [
                                StatCard(
                                  label: 'Total Members',
                                  value: '${stats['totalMembers'] ?? 0}',
                                  icon: Icons.groups_rounded,
                                  color: AppColors.primary,
                                  changeLabel: 'All time',
                                ),
                                StatCard(
                                  label: 'Active Memberships',
                                  value: '${stats['activeMembers'] ?? 0}',
                                  icon: Icons.verified_rounded,
                                  color: AppColors.success,
                                  changeLabel: 'Healthy base',
                                ),
                                StatCard(
                                  label: 'Expired Plans',
                                  value: '${stats['expiredMembers'] ?? 0}',
                                  icon: Icons.error_outline_rounded,
                                  color: AppColors.danger,
                                  changeLabel: 'Needs follow-up',
                                ),
                                StatCard(
                                  label: 'Expiring in 7 Days',
                                  value: '${stats['expiringSoon'] ?? 0}',
                                  icon: Icons.notifications_active_outlined,
                                  color: AppColors.warning,
                                  changeLabel: 'Retention',
                                ),
                                StatCard(
                                  label: 'Monthly Revenue',
                                  value: 'Rs ${stats['revenueThisMonth'] ?? 0}',
                                  icon: Icons.currency_rupee_rounded,
                                  color: AppColors.accent,
                                  changeLabel: 'This month',
                                ),
                                StatCard(
                                  label: 'Today Visits',
                                  value: '${stats['todayVisits'] ?? 0}',
                                  icon: Icons.fingerprint_rounded,
                                  color: AppColors.info,
                                  changeLabel: 'Live usage',
                                ),
                              ],
                            ),
                            const SizedBox(height: 24),
                            _OperationsBoard(stats: stats),
                          ],
                        ),
            ),
          ),
        ],
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

class _DashboardHero extends StatelessWidget {
  final String greeting;
  final String name;
  final String dateStr;
  final String totalMembers;
  final String revenue;

  const _DashboardHero({
    required this.greeting,
    required this.name,
    required this.dateStr,
    required this.totalMembers,
    required this.revenue,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.fromLTRB(22, 22, 22, 22),
      decoration: BoxDecoration(
        gradient: AppGradients.hero,
        borderRadius: BorderRadius.circular(30),
        boxShadow: const [
          BoxShadow(
            color: Color(0x26083A82),
            blurRadius: 28,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      dateStr,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.72),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '$greeting, $name',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.8,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 58,
                height: 58,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
                ),
                child: const Icon(Icons.fitness_center_rounded, color: Colors.white, size: 28),
              ),
            ],
          ),
          const SizedBox(height: 22),
          Row(
            children: [
              Expanded(
                child: _HeroMetric(label: 'Members under management', value: totalMembers),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _HeroMetric(label: 'Monthly collection', value: revenue),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroMetric extends StatelessWidget {
  final String label;
  final String value;

  const _HeroMetric({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: AppGradients.overlay,
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.74),
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 23,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.6,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String eyebrow;
  final String title;
  final String subtitle;

  const _SectionTitle({
    required this.eyebrow,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          eyebrow.toUpperCase(),
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 11.5,
            letterSpacing: 1.2,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          title,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 22,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.6,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          subtitle,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 13,
            height: 1.45,
          ),
        ),
      ],
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionTile(
            icon: Icons.person_add_alt_1_rounded,
            label: 'Add Member',
            subtitle: 'Register new walk-ins quickly',
            color: AppColors.primary,
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AddMemberScreen())),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: _ActionTile(
            icon: Icons.groups_rounded,
            label: 'Open Members',
            subtitle: 'Search, renew and manage',
            color: AppColors.accent,
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const MemberListScreen())),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: _ActionTile(
            icon: Icons.fingerprint_rounded,
            label: 'Access Logs',
            subtitle: 'Track entry events live',
            color: AppColors.info,
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
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ActionTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onTap,
        child: Ink(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.border),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0D0F172A),
                blurRadius: 18,
                offset: Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(height: 16),
              Text(
                label,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 6),
              Text(
                subtitle,
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5, height: 1.4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OperationsBoard extends StatelessWidget {
  final Map<String, dynamic> stats;

  const _OperationsBoard({required this.stats});

  @override
  Widget build(BuildContext context) {
    final activeMembers = (stats['activeMembers'] ?? 0) as num;
    final totalMembers = (stats['totalMembers'] ?? 0) as num;
    final activeRate = totalMembers == 0 ? 0 : ((activeMembers / totalMembers) * 100).round();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Operations health',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 6),
            const Text(
              'A quick quality signal for retention and active usage across the gym.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 20),
            _BoardRow(
              label: 'Active member ratio',
              value: '$activeRate%',
              color: AppColors.primary,
            ),
            const SizedBox(height: 14),
            _BoardRow(
              label: 'Members expiring soon',
              value: '${stats['expiringSoon'] ?? 0}',
              color: AppColors.warning,
            ),
            const SizedBox(height: 14),
            _BoardRow(
              label: 'Today access activity',
              value: '${stats['todayVisits'] ?? 0}',
              color: AppColors.info,
            ),
          ],
        ),
      ),
    );
  }
}

class _BoardRow extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _BoardRow({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
            ),
          ),
          Text(
            value,
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: color),
          ),
        ],
      ),
    );
  }
}

class _DashboardError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _DashboardError({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.cloud_off_rounded, color: AppColors.danger, size: 30),
            ),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 8),
            const Text(
              'Refresh once the backend is available to bring all operational data back.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 18),
            OutlinedButton(onPressed: onRetry, child: const Text('Retry'))
          ],
        ),
      ),
    );
  }
}
