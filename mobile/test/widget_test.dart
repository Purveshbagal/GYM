import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:gym_app/main.dart';

void main() {
  testWidgets('App boots to the login screen', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const GymApp());
    await tester.pump(); // builds the initial CircularProgressIndicator frame
    await tester.pump(); // AuthProvider.init() resolves, swaps to LoginScreen

    expect(find.text('Shree Ram Fitness'), findsOneWidget);
    expect(find.byType(TextFormField), findsWidgets);
  });
}
