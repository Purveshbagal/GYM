import 'package:flutter/foundation.dart';
import '../models/device.dart';
import '../services/api_service.dart';

class DeviceProvider extends ChangeNotifier {
  List<GymDevice> devices = [];
  bool loading = false;

  Future<void> fetchDevices() async {
    loading = true;
    notifyListeners();
    final res = await ApiService.instance.get('/api/devices');
    devices = (res['devices'] as List).map((e) => GymDevice.fromJson(e)).toList();
    loading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>> addDevice({
    required String name,
    required String ip,
    required int port,
    required String username,
    required String password,
    String? location,
  }) async {
    final res = await ApiService.instance.post('/api/devices', {
      'name': name,
      'ip': ip,
      'port': port,
      'username': username,
      'password': password,
      'location': location,
    });
    await fetchDevices();
    return res;
  }

  Future<Map<String, dynamic>> syncDevice(String id) async {
    final res = await ApiService.instance.post('/api/devices/$id/sync');
    await fetchDevices();
    return res;
  }

  Future<void> deleteDevice(String id) async {
    await ApiService.instance.delete('/api/devices/$id');
    await fetchDevices();
  }
}
