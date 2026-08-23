import 'package:flutter/foundation.dart';
import '../models/member.dart';
import '../services/api_service.dart';

class MemberProvider extends ChangeNotifier {
  List<Member> members = [];
  bool loading = false;

  Future<void> fetchMembers({String? status, String? search}) async {
    loading = true;
    notifyListeners();
    final query = <String, String>{};
    if (status != null) query['status'] = status;
    if (search != null && search.isNotEmpty) query['search'] = search;
    final res = await ApiService.instance.get('/api/members', query: query);
    members = (res['members'] as List).map((e) => Member.fromJson(e)).toList();
    loading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>> createMember({
    required String name,
    required String phone,
    String? email,
    String? gender,
    required String planId,
    double? amountPaid,
    String? paymentMethod,
    String? deviceId,
  }) async {
    final res = await ApiService.instance.post('/api/members', {
      'name': name,
      'phone': phone,
      'email': email,
      'gender': gender,
      'planId': planId,
      'amountPaid': amountPaid,
      'paymentMethod': paymentMethod,
      'deviceId': deviceId,
    });
    await fetchMembers();
    return res;
  }

  Future<Map<String, dynamic>> fetchMemberDetail(String id) async {
    return await ApiService.instance.get('/api/members/$id');
  }

  Future<void> renewMembership(String id, {required String planId, double? amountPaid, String? paymentMethod}) async {
    await ApiService.instance.post('/api/members/$id/renew', {
      'planId': planId,
      'amountPaid': amountPaid,
      'paymentMethod': paymentMethod,
    });
    await fetchMembers();
  }

  Future<void> toggleAccess(String id, bool enable) async {
    await ApiService.instance.post('/api/members/$id/toggle', {'enable': enable});
    await fetchMembers();
  }

  Future<void> markEnrolled(String id) async {
    await ApiService.instance.post('/api/members/$id/enrolled');
    await fetchMembers();
  }

  Future<void> deleteMember(String id) async {
    await ApiService.instance.delete('/api/members/$id');
    await fetchMembers();
  }
}
