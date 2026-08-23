import 'package:flutter/foundation.dart';
import '../models/plan.dart';
import '../services/api_service.dart';

class PlanProvider extends ChangeNotifier {
  List<MembershipPlan> plans = [];
  bool loading = false;

  Future<void> fetchPlans() async {
    loading = true;
    notifyListeners();
    final res = await ApiService.instance.get('/api/plans');
    plans = (res['plans'] as List).map((e) => MembershipPlan.fromJson(e)).toList();
    loading = false;
    notifyListeners();
  }

  Future<void> createPlan({
    required String name,
    required int durationMonths,
    required double fees,
    String? description,
  }) async {
    await ApiService.instance.post('/api/plans', {
      'name': name,
      'durationMonths': durationMonths,
      'fees': fees,
      'description': description,
    });
    await fetchPlans();
  }

  Future<void> updatePlan(String id, Map<String, dynamic> data) async {
    await ApiService.instance.put('/api/plans/$id', data);
    await fetchPlans();
  }

  Future<void> deactivatePlan(String id) async {
    await ApiService.instance.delete('/api/plans/$id');
    await fetchPlans();
  }
}
