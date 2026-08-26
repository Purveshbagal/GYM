import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<AuthProvider>().login(_username.text.trim(), _password.text);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not reach server. Check your connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const Positioned.fill(child: _LoginBackdrop()),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: constraints.maxHeight - 40),
                    child: Column(
                        children: [
                          const SizedBox(height: 12),
                          const _BrandHeader(),
                          const SizedBox(height: 24),
                          Center(
                              child: ConstrainedBox(
                                constraints: const BoxConstraints(maxWidth: 440),
                                child: Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(24),
                                    child: Form(
                                      key: _formKey,
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.stretch,
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Text(
                                            'Admin Access',
                                            style: TextStyle(
                                              fontSize: 28,
                                              fontWeight: FontWeight.w800,
                                              letterSpacing: -0.8,
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                          const Text(
                                            'Securely sign in to manage members, revenue, access control and premium gym operations.',
                                            style: TextStyle(
                                              color: AppColors.textSecondary,
                                              fontSize: 13.5,
                                              height: 1.5,
                                            ),
                                          ),
                                          const SizedBox(height: 24),
                                          _FieldLabel(
                                            label: 'Username',
                                            child: TextFormField(
                                              controller: _username,
                                              textInputAction: TextInputAction.next,
                                              decoration: const InputDecoration(
                                                hintText: 'Enter staff username',
                                                prefixIcon: Icon(Icons.person_outline_rounded),
                                              ),
                                              validator: (v) => (v == null || v.isEmpty) ? 'Enter your username' : null,
                                            ),
                                          ),
                                          const SizedBox(height: 16),
                                          _FieldLabel(
                                            label: 'Password',
                                            child: TextFormField(
                                              controller: _password,
                                              obscureText: _obscure,
                                              textInputAction: TextInputAction.done,
                                              onFieldSubmitted: (_) => _submit(),
                                              decoration: InputDecoration(
                                                hintText: 'Enter secure password',
                                                prefixIcon: const Icon(Icons.lock_outline_rounded),
                                                suffixIcon: IconButton(
                                                  icon: Icon(
                                                    _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                                                  ),
                                                  onPressed: () => setState(() => _obscure = !_obscure),
                                                ),
                                              ),
                                              validator: (v) => (v == null || v.isEmpty) ? 'Enter your password' : null,
                                            ),
                                          ),
                                          if (_error != null) ...[
                                            const SizedBox(height: 16),
                                            Container(
                                              padding: const EdgeInsets.all(14),
                                              decoration: BoxDecoration(
                                                color: AppColors.danger.withValues(alpha: 0.08),
                                                borderRadius: BorderRadius.circular(18),
                                                border: Border.all(color: AppColors.danger.withValues(alpha: 0.18)),
                                              ),
                                              child: Row(
                                                children: [
                                                  const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 20),
                                                  const SizedBox(width: 10),
                                                  Expanded(
                                                    child: Text(
                                                      _error!,
                                                      style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                          const SizedBox(height: 24),
                                          FilledButton(
                                            onPressed: _loading ? null : _submit,
                                            child: _loading
                                                ? const SizedBox(
                                                    width: 22,
                                                    height: 22,
                                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                                  )
                                                : const Text('Enter Dashboard'),
                                          ),
                                          const SizedBox(height: 16),
                                          Container(
                                            padding: const EdgeInsets.all(14),
                                            decoration: BoxDecoration(
                                              color: AppColors.surface,
                                              borderRadius: BorderRadius.circular(18),
                                            ),
                                            child: const Row(
                                              children: [
                                                Icon(Icons.verified_user_outlined, color: AppColors.primary, size: 18),
                                                SizedBox(width: 10),
                                                Expanded(
                                                  child: Text(
                                                    'Access is restricted to verified staff accounts only.',
                                                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12.5),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String label;
  final Widget child;

  const _FieldLabel({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppColors.textSecondary,
            letterSpacing: 0.6,
          ),
        ),
        const SizedBox(height: 8),
        child,
      ],
    );
  }
}

class _BrandHeader extends StatelessWidget {
  const _BrandHeader();

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 520),
      child: Container(
        padding: const EdgeInsets.all(24),
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
            Container(
              width: 64,
              height: 64,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
              ),
              child: const Icon(Icons.fitness_center_rounded, size: 30, color: Colors.white),
            ),
            const SizedBox(height: 20),
            const Text(
              'Shree Ram Fitness',
              style: TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.8,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoginBackdrop extends StatelessWidget {
  const _LoginBackdrop();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFF7F9FD), Color(0xFFF0F4FA)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -80,
            left: -40,
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary.withValues(alpha: 0.08),
              ),
            ),
          ),
          Positioned(
            bottom: -60,
            right: -20,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.accent.withValues(alpha: 0.08),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
