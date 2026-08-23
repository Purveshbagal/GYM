class GymDevice {
  final String id;
  final String name;
  final String ip;
  final int port;
  final String? location;
  final bool online;

  GymDevice({
    required this.id,
    required this.name,
    required this.ip,
    required this.port,
    this.location,
    required this.online,
  });

  factory GymDevice.fromJson(Map<String, dynamic> json) {
    return GymDevice(
      id: json['_id'],
      name: json['name'],
      ip: json['ip'],
      port: json['port'] ?? 80,
      location: json['location'],
      online: json['online'] ?? false,
    );
  }
}
