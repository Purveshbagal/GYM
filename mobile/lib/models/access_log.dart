class AccessLogEntry {
  final String id;
  final String? memberName;
  final String? employeeNo;
  final String result; // granted | denied
  final String? reason;
  final String? verifyMode;
  final DateTime occurredAt;

  AccessLogEntry({
    required this.id,
    this.memberName,
    this.employeeNo,
    required this.result,
    this.reason,
    this.verifyMode,
    required this.occurredAt,
  });

  factory AccessLogEntry.fromJson(Map<String, dynamic> json) {
    final member = json['member'];
    return AccessLogEntry(
      id: json['_id'],
      memberName: member is Map<String, dynamic> ? member['name'] : null,
      employeeNo: json['employeeNo'],
      result: json['result'] ?? 'denied',
      reason: json['reason'],
      verifyMode: json['verifyMode'],
      occurredAt: DateTime.parse(json['occurredAt']),
    );
  }
}
