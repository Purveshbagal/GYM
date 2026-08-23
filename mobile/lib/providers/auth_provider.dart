import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  bool _loggedIn = false;
  String? _name;
  String? _username;
  String? _role;
  bool _initializing = true;

  bool get loggedIn => _loggedIn;
  String? get name => _name;
  String? get username => _username;
  String? get role => _role;
  bool get initializing => _initializing;

  Future<void> init() async {
    await ApiService.instance.loadToken();
    _loggedIn = ApiService.instance.isLoggedIn;
    _initializing = false;
    notifyListeners();
  }

  Future<void> login(String username, String password) async {
    final res = await ApiService.instance.post('/api/auth/login', {
      'username': username,
      'password': password,
    });
    await ApiService.instance.setToken(res['token']);
    _name = res['user']?['name'];
    _username = res['user']?['username'];
    _role = res['user']?['role'];
    _loggedIn = true;
    notifyListeners();
  }

  Future<void> logout() async {
    await ApiService.instance.setToken(null);
    _loggedIn = false;
    notifyListeners();
  }
}
