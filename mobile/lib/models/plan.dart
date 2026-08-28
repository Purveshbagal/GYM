class MembershipPlan {
  final String id;
  final String name;
  final int durationMonths;
  final double fees;
  final String? description;
  final bool active;

  MembershipPlan({
    required this.id,
    required this.name,
    required this.durationMonths,
    required this.fees,
    this.description,
    this.active = true,
  });

  factory MembershipPlan.fromJson(Map<String, dynamic> json) {
    return MembershipPlan(
      id: json['_id'],
      name: json['name'],
      durationMonths: json['durationMonths'],
      fees: (json['fees'] as num).toDouble(),
      description: json['description'],
      active: json['active'] ?? true,
    );
  }
}
