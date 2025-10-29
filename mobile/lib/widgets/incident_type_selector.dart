import 'package:flutter/material.dart';
import 'package:safe_egypt_v2/components/incident_type.dart';
import 'package:easy_localization/easy_localization.dart';

class IncidentTypeSelector extends StatelessWidget {
  final Function(IncidentType) onTypeSelected;
  final IncidentType? selectedType;

  const IncidentTypeSelector({
    super.key,
    required this.onTypeSelected,
    this.selectedType,
  });

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      children: [
        _buildTypeCard(
          context,
          IncidentType.fire,
          'incidents.fire'.tr(),
          Colors.red,
          Icons.local_fire_department,
        ),
        _buildTypeCard(
          context,
          IncidentType.trafficAccident,
          'incidents.traffic_accident'.tr(),
          Colors.orange,
          Icons.directions_car,
        ),
        _buildTypeCard(
          context,
          IncidentType.violenceCrime,
          'incidents.violence_crime'.tr(),
          Colors.amber,
          Icons.warning,
        ),
        _buildTypeCard(
          context,
          IncidentType.medicalEmergency,
          'incidents.medical_emergency'.tr(),
          Colors.blue,
          Icons.medical_services,
        ),
        _buildTypeCard(
          context,
          IncidentType.other,
          'incidents.other'.tr(),
          Colors.grey,
          Icons.add,
        ),
      ],
    );
  }

  Widget _buildTypeCard(
    BuildContext context,
    IncidentType type,
    String label,
    Color color,
    IconData icon,
  ) {
    final isSelected = selectedType == type;
    
    return GestureDetector(
      onTap: () => onTypeSelected(type),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(
            color: isSelected ? Theme.of(context).primaryColor : Colors.grey[300]!,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: Colors.white,
                size: 30,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
