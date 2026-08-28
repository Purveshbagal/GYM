import 'package:flutter/material.dart';
import '../theme.dart';

class StatusBadge extends StatelessWidget {
  final String status;

  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    late final Color color;
    late final IconData icon;
    switch (status) {
      case 'active':
        color = AppColors.success;
        icon = Icons.check_circle_rounded;
        break;
      case 'expired':
        color = AppColors.danger;
        icon = Icons.error_rounded;
        break;
      default:
        color = AppColors.textSecondary;
        icon = Icons.pause_circle_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.11),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            status[0].toUpperCase() + status.substring(1),
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w700,
              fontSize: 11.5,
            ),
          ),
        ],
      ),
    );
  }
}
