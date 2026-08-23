import 'plan.dart';

class Member {
  final String id;
  final String deviceUserId;
  final String name;
  final String phone;
  final String? email;
  final String? gender;
  final String? address;
  final DateTime? membershipStart;
  final DateTime? membershipEnd;
  final String status; // active | expired | inactive
  final bool biometricEnrolled;
  final MembershipPlan? currentPlan;

  Member({
    required this.id,
    required this.deviceUserId,
    required this.name,
    required this.phone,
    this.email,
    this.gender,
    this.address,
    this.membershipStart,
    this.membershipEnd,
    required this.status,
    required this.biometricEnrolled,
    this.currentPlan,
  });

  factory Member.fromJson(Map<String, dynamic> json) {
    return Member(
      id: json['_id'],
      deviceUserId: json['deviceUserId'] ?? '',
      name: json['name'] ?? '',
      phone: json['phone'] ?? '',
      email: json['email'],
      gender: json['gender'],
      address: json['address'],
      membershipStart: json['membershipStart'] != null
          ? DateTime.parse(json['membershipStart'])
          : null,
      membershipEnd: json['membershipEnd'] != null
          ? DateTime.parse(json['membershipEnd'])
          : null,
      status: json['status'] ?? 'inactive',
      biometricEnrolled: json['biometricEnrolled'] ?? false,
      currentPlan: json['currentPlan'] is Map<String, dynamic>
          ? MembershipPlan.fromJson(json['currentPlan'])
          : null,
    );
  }

  int get daysLeft {
    if (membershipEnd == null) return 0;
    return membershipEnd!.difference(DateTime.now()).inDays;
  }
}
