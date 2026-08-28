import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/member_provider.dart';
import '../../theme.dart';
import '../../widgets/status_badge.dart';
import 'add_member_screen.dart';
import 'member_detail_screen.dart';

class MemberListScreen extends StatefulWidget {
  const MemberListScreen({super.key});

  @override
  State<MemberListScreen> createState() => _MemberListScreenState();
}

class _MemberListScreenState extends State<MemberListScreen> {
  String? _statusFilter;
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    await context.read<MemberProvider>().fetchMembers(status: _statusFilter, search: _search.text);
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MemberProvider>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Members'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: FilledButton.tonalIcon(
              onPressed: () async {
                await Navigator.push(context, MaterialPageRoute(builder: (_) => const AddMemberScreen()));
                _load();
              },
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Add'),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
          children: [
            const _HeaderCard(),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    TextField(
                      controller: _search,
                      decoration: const InputDecoration(
                        hintText: 'Search by name, phone or device ID',
                        prefixIcon: Icon(Icons.search_rounded, size: 20),
                      ),
                      onSubmitted: (_) => _load(),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      height: 42,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          _filterChip(null, 'All'),
                          _filterChip('active', 'Active'),
                          _filterChip('expired', 'Expired'),
                          _filterChip('inactive', 'Inactive'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (provider.loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 100),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (provider.members.isEmpty)
              const _EmptyState()
            else
              ...provider.members.map((m) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Card(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(24),
                      onTap: () async {
                        await Navigator.push(context, MaterialPageRoute(builder: (_) => MemberDetailScreen(memberId: m.id)));
                        _load();
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Container(
                              width: 56,
                              height: 56,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                gradient: AppGradients.hero,
                                borderRadius: BorderRadius.circular(18),
                              ),
                              child: Text(
                                m.name.isNotEmpty ? m.name[0].toUpperCase() : '?',
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    m.name,
                                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                                  ),
                                  const SizedBox(height: 5),
                                  Text(
                                    '${m.phone} • ID ${m.deviceUserId}',
                                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5),
                                  ),
                                  if (m.currentPlan != null) ...[
                                    const SizedBox(height: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: AppColors.accentSoft,
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      child: Text(
                                        m.currentPlan!.name,
                                        style: const TextStyle(
                                          color: AppColors.accent,
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                StatusBadge(status: m.status),
                                const SizedBox(height: 12),
                                const Icon(Icons.arrow_forward_ios_rounded, color: AppColors.textMuted, size: 16),
                              ],
                            ),
                          ],
                        ),
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

  Widget _filterChip(String? value, String label) {
    final selected = _statusFilter == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        showCheckmark: false,
        labelStyle: TextStyle(
          color: selected ? Colors.white : AppColors.textPrimary,
          fontWeight: FontWeight.w700,
          fontSize: 12.5,
        ),
        onSelected: (_) {
          setState(() => _statusFilter = value);
          _load();
        },
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard();

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
            'Member Directory',
            style: TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.7,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Search and monitor every enrolled member with a cleaner, premium front-desk workflow.',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.82),
              fontSize: 13,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

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
              child: const Icon(Icons.groups_outlined, size: 34, color: AppColors.primary),
            ),
            const SizedBox(height: 16),
            const Text(
              'No members found',
              style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 6),
            const Text(
              'Try a different search or filter to refine your results.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
