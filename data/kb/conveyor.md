---
equipmentType: conveyor
manualId: conveyor-m1
revision: 1.5
---

# Heavy-Duty Belt Conveyor Operations and Mechanical Service Manual

## Equipment Overview and Normal Operating Ranges

Industrial belt conveyors handle the continuous bulk transportation of parcels, ores, and manufactured goods across manufacturing facilities and processing terminals. The system comprises a continuous reinforced vulcanized elastomeric belt supported by troughing carrying idlers and return rollers, tensioned by a gravity take-up counterweight unit, and propelled by a rubber-lagged head drive pulley powered by an electric motor coupled to a helical gearbox.

Under normal continuous operation with balanced material loading, belt travel remains centered on idler troughs without lateral wandering or slippage. Baseline operating parameters include:
- Belt Surface Velocity: Operates within 1.2 to 2.5 m/s according to process material throughput.
- Drive Pulley Bearing Temperature: Monitored on head pulley pillow block bearings between 30°C and 65°C.
- Tail Pulley Bearing Temperature: Monitored on tail drum take-up bearings between 25°C and 60°C.
- Gearbox Drive Motor Current: Running electrical load stays within 15 to 35 A.
- Gearbox Vibration RMS: Speed reducer casing vibration remains between 0.5 and 3.0 mm/s.
- Belt Lateral Drift (Misalignment): Belt center tracking deviation is maintained between 0 and 10 mm.

## Fault Descriptions

### Belt Tracking Misalignment and Edge Fraying
- Symptoms: Belt wanders laterally toward conveyor frame; rubber belt edges rub against structural steel stringers creating friction smoke and shredded rubber debris; spillage of carried goods.
- Typical Causes: Uneven off-center chute loading, seized carrying idler rollers, crooked mechanical belt splice, or accumulated debris buildup on return idlers.
- Related Sensor Signatures: Belt misalignment sensor registering drift exceeding 20 mm (critical emergency trip > 35 mm to prevent structural cutting).

### Drive Pulley Pillow Block Bearing Seizure
- Symptoms: Loud squeal or rhythmic crunching at head pulley drive station; smoke or burned grease odor; pillow block housing too hot to touch.
- Typical Causes: Lubricant contamination with abrasive dust, grease starvation, excessive belt take-up tension, or water ingress from washdown spray.
- Related Sensor Signatures: Drive pulley bearing temperature rising past 75°C (critical emergency stop > 90°C), with elevated gearbox vibration.

### Speed Reducer Gearbox Tooth Wear and Bearing Fatigue
- Symptoms: Metallic grinding growl that changes frequency with load; excessive backlash; bronze or steel particles visible on magnetic oil drain plug.
- Typical Causes: Loss of synthetic gear oil viscosity, tooth pitting from impact loading, or shaft misalignment between motor and reducer.
- Related Sensor Signatures: Gearbox vibration RMS exceeding 4.5 mm/s (critical > 7.0 mm/s), and drive motor current escalating past 40 A.

### Drive Pulley Belt Slippage and Lagging Wear
- Symptoms: Drive pulley rotates while belt slows or stops; burning rubber smoke generated at head pulley; tachometer speed mismatch alarm.
- Typical Causes: Worn or glazed ceramic/rubber pulley lagging, inadequate take-up counterweight tension, or liquid water/oil contamination on underside of belt.
- Related Sensor Signatures: Belt speed dropping below 1.0 m/s (critical slip shutdown < 0.5 m/s) while motor current remains elevated, and drive pulley temperature escalates.

### Seized Idler Roller and Friction Fire Hazard
- Symptoms: Single idler roller stationary under moving belt; flat spot worn into steel roller shell; sparks or localized smoke along conveyor bed.
- Typical Causes: Seized internal ball bearing, string/twine entanglement wrapping around roller end-cap, or corrosion from wet material exposure.
- Related Sensor Signatures: Drive motor current creeping above 40 A due to accumulated parasitic friction load, accompanied by localized thermal hotspots.

### Chute Jamming and Conveyor Overload
- Symptoms: Material backing up in discharge transition hopper; belt motor stalls on thermal overload; belt sags excessively between idlers.
- Typical Causes: Large foreign object obstructing chute outlet, damp material bridging across transfer walls, or downstream receiving equipment trip.
- Related Sensor Signatures: Motor current surging past 40 A (critical overload > 48 A), accompanied by belt velocity decelerating below 1.0 m/s.

## Maintenance Instructions and Procedures

### Belt Tracking and Idler Alignment Procedure
1. Observe conveyor under loaded and unloaded conditions to determine exact wandering location and direction of drift.
2. Under no circumstances should personnel touch a moving belt. Perform all mechanical adjustments from outside guarding zones.
3. Identify troughing idlers immediately preceding the point of deviation.
4. Slightly loosen idler frame mounting bolts on the side toward which the belt is drifting.
5. Tap idler frame forward (in the direction of belt travel) by 2 to 4 mm. Tighten mounting bolts securely.
6. Allow conveyor belt to make at least three complete revolutions to observe tracking response before making further adjustments.

### Gearbox Lubricant Inspection and Oil Change
1. Lockout/Tagout conveyor drive motor at main electrical disconnect.
2. Clean magnetic drain and fill plugs with solvent to remove external dust.
3. Place waste oil container under drain valve; open drain plug while gearbox is still warm from operation.
4. Inspect magnetic plug for metal slivers or gear tooth fragments.
5. Reinstall drain plug with new PTFE sealing tape; fill gearbox with ISO VG 220 synthetic industrial gear oil until oil level reaches the center of the sight glass.
6. Verify vent breather is clear and free of dust clogging.

## Safety Warnings and Hazard Protocols

### Fatal Nip Point and Rotating Drum Entanglement Hazard
The junction between the moving conveyor belt and pulleys creates violent, non-releasable pinch points capable of crushing limbs and causing instantaneous death. All nip points must be fully enclosed with bolted wire mesh guards. Never bypass interlocks, and never lubricate or clean pulleys while the conveyor is in motion.

### Emergency Pull-Cord Cable System Protocol
Conveyor beds are equipped with continuous emergency stop pull-wire cables running along both walkways. Verify proper cable tension and test pull-cord limit switches monthly. Never tie off or bridge pull cables. In the event of person entanglement or material jam, pull cable immediately.

### Stored Mechanical Gravitational Energy Warning
Inclined or heavily loaded conveyors store immense gravitational potential energy. When motor brakes are released, the conveyor can back-drive violently. Always engage mechanical holdback devices and anchor the belt with clamping devices before servicing drive components.

## Alarm Limits and Sensor Thresholds

| Sensor Metric | Key | Unit | Normal Range | Warning Limit | Critical Limit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Belt Linear Velocity | `belt_speed_mps` | m/s | 1.2 – 2.5 | < 1.0 or > 2.8 | < 0.5 or > 3.2 |
| Head Drive Pulley Bearing Temp | `drive_pulley_temp_c` | °C | 30 – 65 | > 75 | > 90 |
| Tail Pulley Bearing Temp | `tail_pulley_temp_c` | °C | 25 – 60 | > 70 | > 85 |
| Drive Motor Current | `motor_current_amps` | A | 15 – 35 | > 40 | > 48 |
| Gearbox Vibration RMS | `gearbox_vibration_rms_mms` | mm/s | 0.5 – 3.0 | > 4.5 | > 7.0 |
| Belt Edge Lateral Drift | `belt_misalignment_mm` | mm | 0 – 10 | > 20 | > 35 |
